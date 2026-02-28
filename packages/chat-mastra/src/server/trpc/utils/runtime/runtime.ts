import type { AppRouter } from "@superset/trpc";
import type { createTRPCClient } from "@trpc/client";
import type { createMastraCode } from "mastracode";

export type RuntimeHarness = Awaited<
	ReturnType<typeof createMastraCode>
>["harness"];
export type RuntimeMcpManager = Awaited<
	ReturnType<typeof createMastraCode>
>["mcpManager"];
export type RuntimeHookManager = Awaited<
	ReturnType<typeof createMastraCode>
>["hookManager"];

export interface RuntimeMcpServerStatus {
	connected: boolean;
	toolCount: number;
	error?: string;
}

export interface RuntimeSession {
	sessionId: string;
	harness: RuntimeHarness;
	mcpManager: RuntimeMcpManager;
	hookManager: RuntimeHookManager;
	mcpManualStatuses: Map<string, RuntimeMcpServerStatus>;
	lastErrorMessage: string | null;
	lastPublishedErrorMessage: string | null;
	cwd: string;
}

type ApiClient = ReturnType<typeof createTRPCClient<AppRouter>>;

interface TextContentPart {
	type: "text";
	text: string;
}
interface MessageLike {
	role: string;
	content: Array<{ type: string; text?: string }>;
	stopReason?: string;
	errorMessage?: string;
}

/**
 * Gate: validates user prompt against hooks before sending.
 * Throws if the hook blocks the message.
 */
export async function onUserPromptSubmit(
	runtime: RuntimeSession,
	userMessage: string,
): Promise<void> {
	if (!runtime.hookManager) return;
	const result = await runtime.hookManager.runUserPromptSubmit(userMessage);
	if (!result.allowed) {
		throw new Error(result.blockReason ?? "Blocked by UserPromptSubmit hook");
	}
}

/**
 * Fire SessionStart hook when a runtime is first created.
 */
export async function runSessionStartHook(
	runtime: RuntimeSession,
): Promise<void> {
	if (!runtime.hookManager) return;
	await runtime.hookManager.runSessionStart();
}

/**
 * Reload hook config so user edits take effect without restarting.
 */
export function reloadHookConfig(runtime: RuntimeSession): void {
	if (!runtime.hookManager) return;
	try {
		runtime.hookManager.reload();
	} catch {
		// Best-effort — swallow reload failures
	}
}

/**
 * Destroy a runtime: fire SessionEnd hook and tear down the harness.
 */
export async function destroyRuntime(runtime: RuntimeSession): Promise<void> {
	if (runtime.hookManager) {
		await runtime.hookManager.runSessionEnd().catch(() => {});
	}
	const harnessWithDestroy = runtime.harness as RuntimeHarness & {
		destroy?: () => Promise<void>;
	};
	await harnessWithDestroy.destroy?.().catch(() => {});
}

/**
 * Subscribe to harness lifecycle events for a runtime session.
 * Call once after creating a runtime — handles stop hooks and title generation.
 */
export function subscribeToSessionEvents(
	runtime: RuntimeSession,
	apiClient: ApiClient,
): void {
	runtime.harness.subscribe((event: unknown) => {
		if (isHarnessErrorEvent(event)) {
			const message = toRuntimeErrorMessage(event.error);
			runtime.lastErrorMessage = message;
			console.error("[chat-mastra] Harness error event", {
				sessionId: runtime.sessionId,
				cwd: runtime.cwd,
				message,
				error: event.error,
			});
			return;
		}
		if (isHarnessWorkspaceErrorEvent(event)) {
			const message = toRuntimeErrorMessage(event.error);
			runtime.lastErrorMessage = message;
			console.error("[chat-mastra] Harness workspace_error event", {
				sessionId: runtime.sessionId,
				cwd: runtime.cwd,
				message,
				error: event.error,
			});
			return;
		}
		if (isHarnessAgentStartEvent(event)) {
			runtime.lastErrorMessage = null;
			return;
		}
		if (!isHarnessAgentEndEvent(event)) {
			return;
		}

		const raw = event.reason;
		const reason = raw === "aborted" || raw === "error" ? raw : "complete";
		console.warn("[chat-mastra] Harness agent_end", {
			sessionId: runtime.sessionId,
			cwd: runtime.cwd,
			reason,
			lastErrorMessage: runtime.lastErrorMessage,
		});
		if (reason === "error") {
			console.error("[chat-mastra] Harness agent_end with error reason", {
				sessionId: runtime.sessionId,
				cwd: runtime.cwd,
				lastErrorMessage: runtime.lastErrorMessage,
			});
			if (!runtime.lastErrorMessage) {
				void backfillRuntimeErrorFromLatestAssistantMessage(runtime);
			}
		}
		if (reason === "complete") {
			runtime.lastErrorMessage = null;
		}
		if (runtime.hookManager) {
			void runtime.hookManager.runStop(undefined, reason).catch(() => {});
		}
		if (reason === "complete") {
			void generateAndSetTitle(runtime, apiClient);
		}
	});
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isHarnessErrorEvent(
	event: unknown,
): event is { type: "error"; error: unknown } {
	return isObjectRecord(event) && event.type === "error" && "error" in event;
}

function isHarnessAgentStartEvent(
	event: unknown,
): event is { type: "agent_start" } {
	return isObjectRecord(event) && event.type === "agent_start";
}

function isHarnessAgentEndEvent(
	event: unknown,
): event is { type: "agent_end"; reason?: string } {
	return isObjectRecord(event) && event.type === "agent_end";
}

function isHarnessWorkspaceErrorEvent(
	event: unknown,
): event is { type: "workspace_error"; error: unknown } {
	return (
		isObjectRecord(event) &&
		event.type === "workspace_error" &&
		"error" in event
	);
}

function toRuntimeErrorMessage(error: unknown): string {
	const providerMessage = extractProviderMessage(error);
	if (providerMessage) {
		return providerMessage;
	}
	if (error instanceof Error) {
		const normalized = normalizeErrorMessage(error.message);
		if (normalized) return normalized;
	}
	if (typeof error === "string") {
		const normalized = normalizeErrorMessage(error);
		if (normalized) return normalized;
	}
	if (isObjectRecord(error)) {
		const maybeMessage = error.message;
		if (typeof maybeMessage === "string") {
			const normalized = normalizeErrorMessage(maybeMessage);
			if (normalized) return normalized;
		}
	}
	return "Unexpected chat error";
}

function normalizeErrorMessage(message: string): string | null {
	const trimmed = message.trim();
	if (!trimmed) return null;
	if (trimmed === "[object Object]") return null;
	return trimmed.replace(/^AI_APICallError\d*\s*:\s*/i, "");
}

function extractProviderMessage(error: unknown): string | null {
	return extractProviderMessageAtDepth(error, 0);
}

function extractProviderMessageAtDepth(
	error: unknown,
	depth: number,
): string | null {
	if (depth > 6 || !isObjectRecord(error)) return null;

	const dataMessage = readNestedString(error, ["data", "error", "message"]);
	if (dataMessage) return dataMessage;

	const nestedErrorMessage = readNestedString(error, ["error", "message"]);
	if (nestedErrorMessage) return nestedErrorMessage;

	const parsedResponseBodyMessage = extractMessageFromResponseBody(
		error.responseBody,
	);
	if (parsedResponseBodyMessage) return parsedResponseBodyMessage;

	const causeMessage = extractProviderMessageAtDepth(error.cause, depth + 1);
	if (causeMessage) return causeMessage;

	const nestedError = extractProviderMessageAtDepth(error.error, depth + 1);
	if (nestedError) return nestedError;

	return null;
}

function readNestedString(
	value: unknown,
	path: readonly string[],
): string | null {
	let current: unknown = value;
	for (const key of path) {
		if (!isObjectRecord(current) || !(key in current)) return null;
		current = current[key];
	}
	if (typeof current !== "string") return null;
	return normalizeErrorMessage(current);
}

function extractMessageFromResponseBody(responseBody: unknown): string | null {
	if (typeof responseBody !== "string" || !responseBody.trim()) return null;
	try {
		const parsed = JSON.parse(responseBody);
		return readNestedString(parsed, ["error", "message"]);
	} catch {
		return null;
	}
}

async function generateAndSetTitle(
	runtime: RuntimeSession,
	apiClient: ApiClient,
): Promise<void> {
	try {
		const messages: MessageLike[] = await runtime.harness.listMessages();
		const userMessages = messages.filter((m) => m.role === "user");
		const userCount = userMessages.length;

		const isFirst = userCount === 1;
		const isRename = userCount > 1 && userCount % 10 === 0;
		if (!isFirst && !isRename) return;

		const extractText = (parts: MessageLike["content"]): string =>
			parts
				.filter((c): c is TextContentPart => c.type === "text")
				.map((c) => c.text)
				.join(" ");

		let text: string;
		const firstMessage = userMessages[0];
		if (isFirst && firstMessage) {
			text = extractText(firstMessage.content).slice(0, 500);
		} else {
			text = messages
				.slice(-10)
				.map((m) => `${m.role}: ${extractText(m.content)}`)
				.join("\n")
				.slice(0, 2000);
		}
		if (!text.trim()) return;

		const mode = runtime.harness.getCurrentMode();
		const agent =
			typeof mode.agent === "function" ? mode.agent({}) : mode.agent;

		const title = await agent.generateTitleFromUserMessage({
			message: text,
			model: runtime.harness.getFullModelId(),
			tracingContext: {},
		});
		if (!title?.trim()) return;

		await apiClient.chat.updateTitle.mutate({
			sessionId: runtime.sessionId,
			title: title.trim(),
		});
	} catch (error) {
		console.warn("[chat-mastra] Title generation failed:", error);
	}
}

async function backfillRuntimeErrorFromLatestAssistantMessage(
	runtime: RuntimeSession,
): Promise<void> {
	try {
		const messages: MessageLike[] = await runtime.harness.listMessages({
			limit: 20,
		});
		const assistantErrorMessage = [...messages]
			.reverse()
			.find(
				(message) =>
					message.role === "assistant" &&
					message.stopReason === "error" &&
					typeof message.errorMessage === "string" &&
					message.errorMessage.trim(),
			)?.errorMessage;
		if (!assistantErrorMessage?.trim()) return;
		runtime.lastErrorMessage = assistantErrorMessage.trim();
		console.error(
			"[chat-mastra] Backfilled runtime error from message history",
			{
				sessionId: runtime.sessionId,
				cwd: runtime.cwd,
				lastErrorMessage: runtime.lastErrorMessage,
			},
		);
	} catch (error) {
		console.warn("[chat-mastra] Failed to backfill runtime error message", {
			sessionId: runtime.sessionId,
			cwd: runtime.cwd,
			error,
		});
	}
}
