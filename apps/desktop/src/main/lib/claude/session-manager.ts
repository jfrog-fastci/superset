/**
 * Claude Code Session Manager
 *
 * Manages Claude SDK sessions using V2 session API.
 * Persists ALL raw SDKMessage objects to the durable stream.
 *
 * Architecture:
 * - All clients POST user messages to the durable stream
 * - This manager watches the stream for new user messages
 * - When a user message appears, it creates/resumes a V2 SDK session
 * - ALL SDK messages are persisted as raw JSON chunks
 * - Client-side materialize() reconstructs UI state from chunks
 */

import { EventEmitter } from "node:events";
import { buildClaudeEnv, getClaudeBinaryPath } from "./index";

const DURABLE_STREAM_URL =
	process.env.DURABLE_STREAM_URL || "http://localhost:8080";

// ============================================================================
// Events (simplified — only for local IPC subscribers)
// ============================================================================

export interface SessionStartEvent {
	type: "session_start";
	sessionId: string;
}

export interface SessionEndEvent {
	type: "session_end";
	sessionId: string;
	exitCode: number | null;
}

export interface ErrorEvent {
	type: "error";
	sessionId: string;
	error: string;
}

export type ClaudeStreamEvent =
	| SessionStartEvent
	| SessionEndEvent
	| ErrorEvent;

// ============================================================================
// Active Session State
// ============================================================================

interface ActiveSession {
	sessionId: string;
	cwd: string;
	claudeSessionId?: string;
	abortController?: AbortController;
	streamEnabled: boolean;
	streamWatcher?: StreamWatcher;
	processingMessageIds: Set<string>;
}

// ============================================================================
// Durable Stream Client
// ============================================================================

class DurableStreamClient {
	private baseUrl: string;
	private eventQueue: Map<string, Array<Record<string, unknown>>> = new Map();
	private flushTimeouts: Map<string, NodeJS.Timeout> = new Map();

	constructor(baseUrl: string) {
		this.baseUrl = baseUrl;
	}

	async createStream(sessionId: string): Promise<boolean> {
		try {
			const response = await fetch(`${this.baseUrl}/streams/${sessionId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
			});
			return response.ok;
		} catch (error) {
			console.error(`[durable-stream] Failed to create stream:`, error);
			return false;
		}
	}

	queueEvent(sessionId: string, event: Record<string, unknown>): void {
		let queue = this.eventQueue.get(sessionId);
		if (!queue) {
			queue = [];
			this.eventQueue.set(sessionId, queue);
		}

		queue.push({
			...event,
			timestamp: Date.now(),
		});

		const existingTimeout = this.flushTimeouts.get(sessionId);
		if (existingTimeout) {
			clearTimeout(existingTimeout);
		}

		if (queue.length >= 10) {
			this.flushEvents(sessionId);
		} else {
			const timeout = setTimeout(() => this.flushEvents(sessionId), 50);
			this.flushTimeouts.set(sessionId, timeout);
		}
	}

	private async flushEvents(sessionId: string): Promise<void> {
		const queue = this.eventQueue.get(sessionId);
		if (!queue || queue.length === 0) return;

		this.eventQueue.set(sessionId, []);
		this.flushTimeouts.delete(sessionId);

		try {
			await fetch(`${this.baseUrl}/streams/${sessionId}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(queue),
			});
		} catch (error) {
			console.error(`[durable-stream] Failed to post events:`, error);
			const currentQueue = this.eventQueue.get(sessionId) || [];
			this.eventQueue.set(sessionId, [...queue, ...currentQueue]);
		}
	}

	async flushAll(sessionId: string): Promise<void> {
		const timeout = this.flushTimeouts.get(sessionId);
		if (timeout) {
			clearTimeout(timeout);
			this.flushTimeouts.delete(sessionId);
		}
		await this.flushEvents(sessionId);
	}

	cleanup(sessionId: string): void {
		this.eventQueue.delete(sessionId);
		const timeout = this.flushTimeouts.get(sessionId);
		if (timeout) {
			clearTimeout(timeout);
			this.flushTimeouts.delete(sessionId);
		}
	}
}

const durableStreamClient = new DurableStreamClient(DURABLE_STREAM_URL);

// ============================================================================
// Stream Watcher
// ============================================================================

class StreamWatcher {
	private intervalId: NodeJS.Timeout | null = null;
	private seenMessageIds: Set<string> = new Set();
	private onNewUserMessage: (messageId: string, content: string) => void;
	private sessionId = "";

	constructor(onNewUserMessage: (messageId: string, content: string) => void) {
		this.onNewUserMessage = onNewUserMessage;
	}

	start(sessionId: string): void {
		this.sessionId = sessionId;
		this.seenMessageIds.clear();
		this.intervalId = setInterval(() => this.poll(), 500);
		console.log(`[stream-watcher] Started polling for ${sessionId}`);
	}

	private async poll(): Promise<void> {
		try {
			const response = await fetch(
				`${DURABLE_STREAM_URL}/streams/${this.sessionId}`,
				{ headers: { Accept: "application/json" } },
			);

			if (!response.ok) return;

			const events = (await response.json()) as Array<Record<string, unknown>>;

			for (const event of events) {
				if (event.type !== "chunk") continue;

				const value = event.value as Record<string, unknown> | undefined;
				if (!value) continue;

				const messageId = value.messageId as string;
				const role = value.role as string;
				const chunk = value.chunk as Record<string, unknown>;
				if (!chunk || typeof chunk !== "object") continue;

				if (role !== "user" || this.seenMessageIds.has(messageId)) continue;

				this.seenMessageIds.add(messageId);

				if (chunk.type === "whole-message" && chunk.content) {
					console.log(`[stream-watcher] New user message: ${messageId}`);
					this.onNewUserMessage(messageId, String(chunk.content));
				}
			}
		} catch {
			// Ignore poll errors
		}
	}

	stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
		this.seenMessageIds.clear();
	}
}

// ============================================================================
// Session Manager
// ============================================================================

// Cache V2 SDK functions
let cachedCreateSession:
	| typeof import("@anthropic-ai/claude-agent-sdk").unstable_v2_createSession
	| null = null;
let cachedResumeSession:
	| typeof import("@anthropic-ai/claude-agent-sdk").unstable_v2_resumeSession
	| null = null;

const getV2SDK = async () => {
	if (cachedCreateSession && cachedResumeSession) {
		return {
			createSession: cachedCreateSession,
			resumeSession: cachedResumeSession,
		};
	}
	const sdk = await import("@anthropic-ai/claude-agent-sdk");
	cachedCreateSession = sdk.unstable_v2_createSession;
	cachedResumeSession = sdk.unstable_v2_resumeSession;
	return {
		createSession: cachedCreateSession,
		resumeSession: cachedResumeSession,
	};
};

class ClaudeSessionManager extends EventEmitter {
	private sessions: Map<string, ActiveSession> = new Map();

	async startSession({
		sessionId,
		cwd,
		claudeSessionId,
		enableDurableStream = true,
	}: {
		sessionId: string;
		cwd: string;
		claudeSessionId?: string;
		enableDurableStream?: boolean;
	}): Promise<void> {
		if (this.sessions.has(sessionId)) {
			console.warn(`[claude/session] Session ${sessionId} already running`);
			return;
		}

		console.log(`[claude/session] Initializing session ${sessionId} in ${cwd}`);

		let streamEnabled = false;
		if (enableDurableStream) {
			streamEnabled = await durableStreamClient.createStream(sessionId);
			if (streamEnabled) {
				console.log(`[claude/session] Durable stream created for ${sessionId}`);
			}
		}

		const session: ActiveSession = {
			sessionId,
			cwd,
			claudeSessionId,
			streamEnabled,
			processingMessageIds: new Set(),
		};

		this.sessions.set(sessionId, session);

		if (streamEnabled) {
			const watcher = new StreamWatcher((messageId, content) => {
				if (session.processingMessageIds.has(messageId)) {
					return;
				}
				session.processingMessageIds.add(messageId);

				this.processUserMessage({ sessionId, content }).finally(() => {
					session.processingMessageIds.delete(messageId);
				});
			});

			session.streamWatcher = watcher;
			watcher.start(sessionId);
		}

		this.emit("event", {
			type: "session_start",
			sessionId,
		} satisfies SessionStartEvent);
	}

	/**
	 * Process a user message through Claude using V2 session API.
	 * Persists ALL raw SDKMessage objects to the durable stream.
	 */
	private async processUserMessage({
		sessionId,
		content,
	}: {
		sessionId: string;
		content: string;
	}): Promise<void> {
		console.log(
			`[claude/session] processUserMessage for ${sessionId}: "${content.slice(0, 50)}..."`,
		);

		const session = this.sessions.get(sessionId);
		if (!session) {
			console.error(`[claude/session] Session ${sessionId} not found`);
			this.emit("event", {
				type: "error",
				sessionId,
				error: "Session not found",
			} satisfies ErrorEvent);
			return;
		}

		if (session.abortController) {
			session.abortController.abort();
		}

		const abortController = new AbortController();
		session.abortController = abortController;

		const binaryPath = getClaudeBinaryPath();
		if (!binaryPath) {
			this.emit("event", {
				type: "error",
				sessionId,
				error: "Claude binary not found",
			} satisfies ErrorEvent);
			return;
		}

		const env = buildClaudeEnv();

		try {
			const { createSession, resumeSession } = await getV2SDK();

			const sessionOptions = {
				model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929",
				pathToClaudeCodeExecutable: binaryPath,
				env,
				permissionMode: "bypassPermissions" as const,
			};

			console.log(`[claude/session] Starting V2 SDK session in ${session.cwd}`);
			console.log(
				`[claude/session] Resume session: ${session.claudeSessionId || "none"}`,
			);

			const sdkSession = session.claudeSessionId
				? resumeSession(session.claudeSessionId, sessionOptions)
				: createSession(sessionOptions);

			// Send user message
			await sdkSession.send(content);

			// Stream and persist ALL SDK messages
			const messageId = crypto.randomUUID();
			let seq = 0;

			for await (const msg of sdkSession.stream()) {
				if (abortController.signal.aborted) {
					console.log(`[claude/session] Stream aborted`);
					break;
				}

				const msgAny = msg as Record<string, unknown>;

				// Extract session ID from init message
				if (msgAny.type === "system" && msgAny.subtype === "init") {
					const sdkSessionId = msgAny.session_id as string | undefined;
					if (sdkSessionId) {
						session.claudeSessionId = sdkSessionId;
						console.log(
							`[claude/session] Got Claude session ID: ${sdkSessionId}`,
						);
					}
				}

				// Persist raw SDK message to durable stream
				if (session.streamEnabled) {
					durableStreamClient.queueEvent(sessionId, {
						type: "chunk",
						key: `${messageId}:${seq}`,
						value: {
							messageId,
							actorId: "claude",
							role: "assistant",
							chunk: msg,
							seq: seq++,
							createdAt: new Date().toISOString(),
						},
						headers: { operation: "upsert" },
					});
				}

				// Log for debugging
				console.log(
					`[claude/session] SDK msg: type=${msgAny.type}, subtype=${(msgAny.subtype as string) || "none"}`,
				);
			}

			sdkSession.close();

			// Flush pending events
			if (session.streamEnabled) {
				await durableStreamClient.flushAll(sessionId);
			}

			console.log(
				`[claude/session] Message processing complete, ${seq} chunks persisted`,
			);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error(`[claude/session] SDK error: ${errorMessage}`);
			if (error instanceof Error && error.stack) {
				console.error(`[claude/session] Stack:`, error.stack);
			}
			this.emit("event", {
				type: "error",
				sessionId,
				error: errorMessage,
			} satisfies ErrorEvent);
		}
	}

	async interrupt({ sessionId }: { sessionId: string }): Promise<void> {
		const session = this.sessions.get(sessionId);
		if (!session) {
			console.warn(
				`[claude/session] Session ${sessionId} not found for interrupt`,
			);
			return;
		}

		console.log(`[claude/session] Interrupting session ${sessionId}`);
		session.abortController?.abort();
	}

	async stopSession({ sessionId }: { sessionId: string }): Promise<void> {
		const session = this.sessions.get(sessionId);
		if (!session) {
			return;
		}

		console.log(`[claude/session] Stopping session ${sessionId}`);
		session.abortController?.abort();
		session.streamWatcher?.stop();
		this.sessions.delete(sessionId);
		durableStreamClient.cleanup(sessionId);
	}

	isSessionActive(sessionId: string): boolean {
		return this.sessions.has(sessionId);
	}

	getActiveSessions(): string[] {
		return Array.from(this.sessions.keys());
	}
}

export const claudeSessionManager = new ClaudeSessionManager();
