/**
 * Self-contained chat hook that owns the entire session lifecycle.
 *
 * Clients just pass sessionId + auth config. Internally this hook:
 * 1. Acquires a cached SessionDB (ref-counted, survives tab switches)
 * 2. Handles preload → ready state
 * 3. Subscribes to the messages collection via useSyncExternalStore
 * 4. Exposes metadata (title, config, presence) via embedded useChatMetadata
 * 5. Provides sendMessage / stop actions as simple POSTs
 */

import { createOptimisticAction } from "@durable-streams/state";
import type { FileUIPart, UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChunkRow } from "../../schema";
import { messageRowToUIMessage } from "../../session-db/collections/messages/materialize";
import {
	type UseChatMetadataReturn,
	useChatMetadata,
} from "./hooks/useChatMetadata";
import { useCollectionData } from "./hooks/useCollectionData";
import { acquireSessionDB, releaseSessionDB } from "./utils/session-db-cache";

export interface UseChatOptions {
	sessionId: string | null;
	proxyUrl: string;
	getHeaders?: () => Record<string, string>;
}

export interface UseChatReturn {
	ready: boolean;
	messages: (UIMessage & { actorId: string; createdAt: Date })[];
	isLoading: boolean;
	sendMessage: (text: string, files?: FileUIPart[]) => Promise<void>;
	stop: () => void;
	submitToolResult: (
		toolCallId: string,
		output: unknown,
		error?: string,
	) => Promise<void>;
	submitApproval: (approvalId: string, approved: boolean) => Promise<void>;
	error: string | null;
	metadata: UseChatMetadataReturn;
}

const STALE_THRESHOLD_MS = 30_000;

export function useChat(options: UseChatOptions): UseChatReturn {
	const { sessionId, proxyUrl, getHeaders } = options;

	// --- SessionDB lifecycle (cached, ref-counted) ---
	// When sessionId is null we skip acquiring a SessionDB entirely.
	// messagesCollection is cached alongside the SessionDB so on remount
	// the already-computed derived collection is reused (avoids empty state
	// from creating a new live query against a pre-populated source).
	const session = useMemo(() => {
		if (!sessionId) return null;
		return acquireSessionDB({
			sessionId,
			baseUrl: `${proxyUrl}/api/chat`,
			headers: getHeaders?.(),
		});
	}, [sessionId, proxyUrl, getHeaders]);

	// For cached (already-preloaded) sessions, start ready immediately so
	// messages render on the very first frame — no "Connecting…" flash.
	const [ready, setReady] = useState(session?.preloaded ?? false);

	useEffect(() => {
		if (!session || !sessionId) {
			setReady(false);
			return;
		}
		let cancelled = false;
		session.preloadPromise
			.then(() => {
				if (!cancelled) setReady(true);
			})
			.catch((err) => console.error("[useChat] preload failed:", err));
		return () => {
			cancelled = true;
			setReady(false);
			releaseSessionDB(sessionId);
		};
	}, [sessionId, session]);

	// --- URL + headers helpers ---
	const headers = useCallback(
		() => ({
			"Content-Type": "application/json",
			...(getHeaders?.() ?? {}),
		}),
		[getHeaders],
	);

	const url = useCallback(
		(path: string) => `${proxyUrl}/api/chat/${sessionId}/stream${path}`,
		[proxyUrl, sessionId],
	);

	// --- Messages via collection pipeline (null-safe) ---
	const rows = useCollectionData(session?.messagesCollection ?? null);

	const messages = useMemo(() => rows.map(messageRowToUIMessage), [rows]);

	// --- Staleness-aware isLoading ---
	// Tick forces re-evaluation so time-based staleness actually triggers.
	const [_tick, setTick] = useState(0);
	useEffect(() => {
		if (!rows.some((r) => !r.isComplete)) return;
		const timer = setInterval(() => setTick((t) => t + 1), 5_000);
		return () => clearInterval(timer);
	}, [rows]);

	const isLoading = useMemo(() => {
		const now = Date.now();
		return rows.some(
			(row) =>
				!row.isComplete && now - row.lastChunkAt.getTime() < STALE_THRESHOLD_MS,
		);
	}, [rows]);

	// --- Metadata (title, config, presence, agents) — null-safe ---
	const metadata = useChatMetadata({
		sessionDB: session?.db ?? null,
		proxyUrl,
		sessionId,
		getHeaders,
	});

	// --- Error state ---
	const [error, setError] = useState<string | null>(null);

	// --- Optimistic sendMessage action ---
	// Stable ref to avoid recreating the optimistic action on every render.
	const depsRef = useRef({ url, headers, sessionDB: session?.db, setError });
	depsRef.current = { url, headers, sessionDB: session?.db, setError };

	const optimisticSend = useMemo(
		() =>
			createOptimisticAction<{
				text: string;
				files?: FileUIPart[];
				messageId: string;
				txid: string;
			}>({
				onMutate: ({ text, files, messageId }) => {
					const { sessionDB } = depsRef.current;
					if (!sessionDB) return;
					const now = new Date().toISOString();
					const parts: ({ type: "text"; text: string } | FileUIPart)[] = [];
					if (text) parts.push({ type: "text", text });
					if (files) parts.push(...files);
					const chunk: ChunkRow = {
						id: `${messageId}:0`,
						messageId,
						actorId: "user",
						role: "user",
						chunk: JSON.stringify({
							type: "whole-message",
							message: {
								id: messageId,
								role: "user",
								parts,
								createdAt: now,
							},
						}),
						seq: 0,
						createdAt: now,
					};
					sessionDB.collections.chunks.insert(chunk);
				},
				mutationFn: async ({ text, files, messageId, txid }) => {
					const { url, headers, sessionDB } = depsRef.current;
					const res = await fetch(url("/messages"), {
						method: "POST",
						headers: headers(),
						body: JSON.stringify({
							content: text || undefined,
							messageId,
							txid,
							...(files && files.length > 0 ? { files } : {}),
						}),
					});
					if (!res.ok) {
						throw new Error(`Failed to send message: ${res.status}`);
					}
					// Wait for the write to sync back through SSE
					await sessionDB?.utils.awaitTxId(txid, 10_000);
				},
			}),
		[],
	);

	const sendMessage = useCallback(
		async (text: string, files?: FileUIPart[]) => {
			if (!sessionId) return;
			setError(null);
			const messageId = crypto.randomUUID();
			const txid = crypto.randomUUID();
			try {
				const tx = optimisticSend({ text, files, messageId, txid });
				await tx.isPersisted.promise;
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to send message");
			}
		},
		[optimisticSend, sessionId],
	);

	const stop = useCallback(() => {
		if (!sessionId) return;
		fetch(url("/control"), {
			method: "POST",
			headers: headers(),
			body: JSON.stringify({ action: "abort" }),
		}).catch(console.error);
	}, [url, headers, sessionId]);

	const submitToolResult = useCallback(
		async (toolCallId: string, output: unknown, err?: string) => {
			if (!sessionId) return;
			setError(null);
			try {
				const res = await fetch(url("/tool-results"), {
					method: "POST",
					headers: headers(),
					body: JSON.stringify({
						toolCallId,
						output,
						error: err ?? null,
					}),
				});
				if (!res.ok) {
					setError(`Failed to submit tool result: ${res.status}`);
				}
			} catch (e) {
				setError(
					e instanceof Error ? e.message : "Failed to submit tool result",
				);
			}
		},
		[url, headers, sessionId],
	);

	const submitApproval = useCallback(
		async (approvalId: string, approved: boolean) => {
			if (!sessionId) return;
			setError(null);
			try {
				const res = await fetch(url(`/approvals/${approvalId}`), {
					method: "POST",
					headers: headers(),
					body: JSON.stringify({ approved }),
				});
				if (!res.ok) {
					setError(`Failed to submit approval: ${res.status}`);
				}
			} catch (e) {
				setError(e instanceof Error ? e.message : "Failed to submit approval");
			}
		},
		[url, headers, sessionId],
	);

	return {
		ready,
		messages,
		isLoading,
		sendMessage,
		stop,
		submitToolResult,
		submitApproval,
		error,
		metadata,
	};
}
