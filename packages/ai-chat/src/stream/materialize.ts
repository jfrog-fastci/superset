/**
 * Message Materialization (SDK-Native)
 *
 * Materializes structured messages from raw SDK message objects stored
 * in the durable stream. No transform layer, no JSON parsing — SDK
 * message objects flow through the stream as structured data.
 */

import type {
	SDKAssistantMessage,
	SDKMessage,
	SDKPartialAssistantMessage,
	SDKResultMessage,
	SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import type {
	BetaContentBlock,
	BetaRawContentBlockDeltaEvent,
	BetaRawContentBlockStartEvent,
	BetaTextBlock,
	BetaToolUseBlock,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { StreamChunk } from "./schema";

// ============================================================================
// Custom Types (no SDK equivalent)
// ============================================================================

export type MessageRole = "user" | "assistant" | "system";

/** Pre-merged tool result — SDK has no joined tool_use + tool_result concept */
export interface ToolResult {
	output: string;
	isError: boolean;
}

/** Materialized UI state from durable stream chunks */
export interface MessageRow {
	id: string;
	role: MessageRole;
	content: string;
	contentBlocks: BetaContentBlock[];
	toolResults: Map<string, ToolResult>;
	actorId: string;
	isComplete: boolean;
	isStreaming: boolean;
	createdAt: Date;
}

export type ChunkRow = StreamChunk & { id: string };

// ============================================================================
// Materialize
// ============================================================================

/**
 * Materialize a message from collected chunk rows.
 *
 * Each chunk's `chunk` field is a raw SDK message object (no JSON parsing).
 * User messages use `{ type: "whole-message", content }` format.
 * Assistant messages are raw SDKMessage objects from the Claude Agent SDK.
 */
export function materializeMessage(rows: ChunkRow[]): MessageRow {
	if (!rows || rows.length === 0) {
		throw new Error("Cannot materialize message from empty rows");
	}

	const sorted = [...rows].sort((a, b) => a.seq - b.seq);
	const first = sorted[0];
	if (!first) {
		throw new Error("Cannot materialize message from empty rows");
	}

	// User messages: simple format, single chunk
	if (first.role === "user") {
		const chunk = first.chunk;
		const content =
			chunk.type === "whole-message" ? String(chunk.content ?? "") : "";
		return {
			id: first.messageId,
			role: "user",
			content,
			contentBlocks: [],
			toolResults: new Map(),
			actorId: first.actorId,
			isComplete: true,
			isStreaming: false,
			createdAt: new Date(first.createdAt),
		};
	}

	// Assistant messages: classify by SDK message type
	let assistantMsg: SDKAssistantMessage | null = null;
	const streamEvents: SDKPartialAssistantMessage[] = [];
	const userMsgs: SDKUserMessage[] = [];
	let resultMsg: SDKResultMessage | null = null;

	for (const row of sorted) {
		const msg = row.chunk as unknown as SDKMessage;
		switch (msg.type) {
			case "assistant":
				assistantMsg = msg;
				break;
			case "stream_event":
				streamEvents.push(msg);
				break;
			case "user":
				userMsgs.push(msg);
				break;
			case "result":
				resultMsg = msg;
				break;
		}
	}

	// Build content blocks
	let contentBlocks: BetaContentBlock[];
	let isStreaming: boolean;

	if (assistantMsg) {
		contentBlocks = assistantMsg.message.content;
		isStreaming = false;
	} else {
		contentBlocks = buildBlocksFromStreamEvents(streamEvents);
		isStreaming = !resultMsg;
	}

	// Build tool results from user messages (tool_result blocks)
	const toolResults = new Map<string, ToolResult>();
	for (const userMsg of userMsgs) {
		const msgContent = userMsg.message.content;
		if (!Array.isArray(msgContent)) continue;

		for (const block of msgContent) {
			if (typeof block !== "object" || block === null) continue;
			if (!("type" in block) || block.type !== "tool_result") continue;

			const tr = block as {
				tool_use_id?: string;
				content?: string | Array<{ type: string; text?: string }>;
				is_error?: boolean;
			};
			if (!tr.tool_use_id) continue;

			let output = "";
			if (typeof tr.content === "string") {
				output = tr.content;
			} else if (Array.isArray(tr.content)) {
				output = tr.content
					.filter((c) => c.type === "text" && c.text)
					.map((c) => c.text as string)
					.join("");
			}

			toolResults.set(tr.tool_use_id, {
				output,
				isError: tr.is_error ?? false,
			});
		}
	}

	// Join text blocks for backward-compat content field
	const content = contentBlocks
		.filter((b): b is BetaTextBlock => b.type === "text")
		.map((b) => b.text)
		.join("");

	return {
		id: first.messageId,
		role: first.role,
		content,
		contentBlocks,
		toolResults,
		actorId: first.actorId,
		isComplete: resultMsg !== null,
		isStreaming,
		createdAt: new Date(first.createdAt),
	};
}

// ============================================================================
// Stream Event Reconstruction
// ============================================================================

function buildBlocksFromStreamEvents(
	events: SDKPartialAssistantMessage[],
): BetaContentBlock[] {
	const blocks: BetaContentBlock[] = [];
	const jsonAccumulators = new Map<number, string>();

	for (const { event } of events) {
		switch (event.type) {
			case "content_block_start": {
				const e = event as BetaRawContentBlockStartEvent;
				blocks[e.index] = { ...e.content_block };
				if (e.content_block.type === "tool_use") {
					jsonAccumulators.set(e.index, "");
				}
				break;
			}

			case "content_block_delta": {
				const e = event as BetaRawContentBlockDeltaEvent;
				const block = blocks[e.index];
				if (!block) break;

				const delta = e.delta;
				if (delta.type === "text_delta" && block.type === "text") {
					(block as BetaTextBlock).text += delta.text;
				} else if (delta.type === "input_json_delta") {
					const accumulated =
						(jsonAccumulators.get(e.index) ?? "") + delta.partial_json;
					jsonAccumulators.set(e.index, accumulated);
					if (block.type === "tool_use") {
						try {
							(block as BetaToolUseBlock).input = JSON.parse(accumulated);
						} catch {
							// Partial JSON
						}
					}
				} else if (
					delta.type === "thinking_delta" &&
					block.type === "thinking"
				) {
					(block as { thinking: string }).thinking += delta.thinking;
				}
				break;
			}

			case "content_block_stop": {
				const index = (event as { index: number }).index;
				const accumulated = jsonAccumulators.get(index);
				const block = blocks[index];
				if (accumulated && block?.type === "tool_use") {
					try {
						(block as BetaToolUseBlock).input = JSON.parse(accumulated);
					} catch {
						// Best effort
					}
					jsonAccumulators.delete(index);
				}
				break;
			}
		}
	}

	return blocks.filter(Boolean);
}

// ============================================================================
// Helpers
// ============================================================================

export function isUserMessage(row: MessageRow): boolean {
	return row.role === "user";
}

export function isAssistantMessage(row: MessageRow): boolean {
	return row.role === "assistant";
}
