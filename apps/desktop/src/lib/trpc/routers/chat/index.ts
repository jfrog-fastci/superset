import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { publicProcedure, router } from "../..";

const MessageSchema = z.object({
	id: z.string(),
	role: z.enum(["user", "assistant"]),
	content: z.string(),
});

export type ChatStreamEvent =
	| { type: "text-delta"; content: string }
	| { type: "finish"; finishReason: string }
	| { type: "error"; error: string };

// Backend API URL - uses NEXT_PUBLIC_API_URL from .env
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const createChatRouter = () => {
	return router({
		/**
		 * Stream a chat response via backend proxy
		 * Uses tRPC subscription with observable pattern (required by trpc-electron)
		 * Calls the backend API which handles the Anthropic integration securely
		 */
		sendMessage: publicProcedure
			.input(
				z.object({
					messages: z.array(MessageSchema),
				}),
			)
			.subscription(({ input }) => {
				return observable<ChatStreamEvent>((emit) => {
					const abortController = new AbortController();

					(async () => {
						try {
							const response = await fetch(`${API_URL}/api/chat`, {
								method: "POST",
								headers: {
									"Content-Type": "application/json",
								},
								body: JSON.stringify({
									messages: input.messages.map((m) => ({
										role: m.role,
										content: m.content,
									})),
								}),
								signal: abortController.signal,
							});

							if (!response.ok) {
								const error = await response.json().catch(() => ({}));
								emit.next({
									type: "error",
									error: error.error || `Backend error: ${response.status}`,
								});
								emit.complete();
								return;
							}

							if (!response.body) {
								emit.next({
									type: "error",
									error: "No response body from backend",
								});
								emit.complete();
								return;
							}

							// Parse the plain text stream from the backend
							const reader = response.body.getReader();
							const decoder = new TextDecoder();

							while (true) {
								const { done, value } = await reader.read();
								if (done) break;
								if (abortController.signal.aborted) break;

								const text = decoder.decode(value, { stream: true });
								if (text) {
									emit.next({ type: "text-delta", content: text });
								}
							}

							emit.next({ type: "finish", finishReason: "stop" });
						} catch (error) {
							if (error instanceof Error && error.name === "AbortError") {
								// User cancelled - don't emit error
							} else {
								console.error("[chat/sendMessage] Error:", error);
								emit.next({
									type: "error",
									error:
										error instanceof Error
											? error.message
											: "Unknown error occurred",
								});
							}
						} finally {
							emit.complete();
						}
					})();

					// Cleanup function - called when subscription ends
					return () => {
						abortController.abort();
					};
				});
			}),

		/**
		 * Simple query to test backend connectivity
		 */
		ping: publicProcedure.query(async () => {
			try {
				const response = await fetch(`${API_URL}/api/chat`, {
					method: "OPTIONS",
				});
				return {
					ok: response.ok || response.status === 405, // 405 is fine, means endpoint exists
					backendUrl: API_URL,
				};
			} catch {
				return {
					ok: false,
					backendUrl: API_URL,
				};
			}
		}),
	});
};
