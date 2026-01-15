import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { publicProcedure, router } from "../..";
import {
	executeWorkspaceTool,
	type WorkspaceToolName,
} from "./tools/workspace-executor";

const MessageSchema = z.object({
	id: z.string(),
	role: z.enum(["user", "assistant"]),
	content: z.string(),
});

export type ToolCallInfo = {
	toolCallId: string;
	toolName: string;
	args: Record<string, unknown>;
};

export type ChatStreamEvent =
	| { type: "text-delta"; content: string }
	| { type: "tool-call"; toolCall: ToolCallInfo }
	| { type: "tool-result"; toolCallId: string; result: unknown }
	| { type: "finish"; finishReason: string }
	| { type: "error"; error: string };

// Backend API URL - uses NEXT_PUBLIC_API_URL from .env
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Parse a UI Message stream line (SSE format)
 * The format is: `data: {"type":"...", ...}`
 *
 * Event types from AI SDK toUIMessageStreamResponse():
 * - text-delta: {type: "text-delta", id: string, delta: string}
 * - tool-input-available: {type: "tool-input-available", toolCallId: string, toolName: string, input: object}
 * - tool-output-available: {type: "tool-output-available", toolCallId: string, output: unknown}
 * - finish: {type: "finish", finishReason: string}
 * - error: {type: "error", error: string}
 */
function parseUIMessageLine(line: string): ChatStreamEvent | null {
	// Skip empty lines
	if (!line.trim()) return null;

	// SSE format: "data: {...}" or "data: [DONE]"
	if (!line.startsWith("data:")) return null;

	const jsonStr = line.slice(5).trim(); // Remove "data:" prefix
	if (!jsonStr || jsonStr === "[DONE]") return null;

	try {
		const data = JSON.parse(jsonStr) as {
			type: string;
			id?: string;
			delta?: string;
			toolCallId?: string;
			toolName?: string;
			input?: Record<string, unknown>;
			output?: unknown;
			finishReason?: string;
			error?: string;
		};

		switch (data.type) {
			case "text-delta": {
				if (data.delta) {
					return { type: "text-delta", content: data.delta };
				}
				return null;
			}
			case "tool-input-available": {
				// Tool call with input ready - this is when we should execute
				if (data.toolCallId && data.toolName) {
					return {
						type: "tool-call",
						toolCall: {
							toolCallId: data.toolCallId,
							toolName: data.toolName,
							args: data.input ?? {},
						},
					};
				}
				return null;
			}
			case "tool-output-available": {
				// Server-side tool result (we handle client-side, so this is informational)
				if (data.toolCallId) {
					return {
						type: "tool-result",
						toolCallId: data.toolCallId,
						result: data.output,
					};
				}
				return null;
			}
			case "finish": {
				return {
					type: "finish",
					finishReason: data.finishReason ?? "stop",
				};
			}
			case "error": {
				return {
					type: "error",
					error: data.error ?? "Unknown error",
				};
			}
			default:
				// Unknown type (start, start-step, text-start, tool-input-start, etc.) - ignore
				return null;
		}
	} catch {
		// Failed to parse JSON, ignore this line
		return null;
	}
}

export const createChatRouter = () => {
	return router({
		/**
		 * Stream a chat response via backend proxy
		 * Uses tRPC subscription with observable pattern (required by trpc-electron)
		 * Calls the backend API which handles the Anthropic integration securely
		 * Parses UI Message stream format and executes tools locally
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

							// Parse UI Message stream
							const reader = response.body.getReader();
							const decoder = new TextDecoder();
							let buffer = "";

							while (true) {
								const { done, value } = await reader.read();
								if (done) break;
								if (abortController.signal.aborted) break;

								buffer += decoder.decode(value, { stream: true });

								// Process complete lines
								const lines = buffer.split("\n");
								buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

								for (const line of lines) {
									const event = parseUIMessageLine(line.trim());
									if (!event) continue;

									if (event.type === "tool-call") {
										// Execute tool locally
										console.log(
											"[chat] Tool call detected:",
											event.toolCall.toolName,
											event.toolCall.args,
										);
										emit.next(event);

										const toolName = event.toolCall
											.toolName as WorkspaceToolName;
										const result = await executeWorkspaceTool(
											toolName,
											event.toolCall.args,
										);

										console.log("[chat] Tool result:", result);

										// Emit tool result
										emit.next({
											type: "tool-result",
											toolCallId: event.toolCall.toolCallId,
											result,
										});
									} else {
										emit.next(event);
									}
								}
							}

							// Process any remaining buffer
							if (buffer.trim()) {
								const event = parseUIMessageLine(buffer.trim());
								if (event) {
									emit.next(event);
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
