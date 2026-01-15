"use client";

import { Loader } from "@superset/ui/ai-elements/loader";
import {
	Message,
	MessageContent,
	MessageResponse,
} from "@superset/ui/ai-elements/message";
import {
	PromptInput,
	PromptInputFooter,
	type PromptInputMessage,
	PromptInputSubmit,
	PromptInputTextarea,
} from "@superset/ui/ai-elements/prompt-input";
import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from "@superset/ui/ai-elements/tool";
import {
	ActiveWorkspaceCard,
	WorkspaceList,
	type Workspace,
	type WorkspaceGroup,
} from "@superset/ui/ai-elements/workspace-list";
import { Button } from "@superset/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import type { ChatStreamEvent, ToolCallInfo } from "lib/trpc/routers/chat";
import { useEffect, useRef, useState } from "react";
import { LuRotateCcw, LuX } from "react-icons/lu";
import { HotkeyTooltipContent } from "renderer/components/HotkeyTooltipContent";
import { trpc } from "renderer/lib/trpc";
import { useChatMessagesStore, useChatPanelStore } from "renderer/stores";

// Tool call state for displaying in UI
type ToolCallState = ToolCallInfo & {
	status: "pending" | "completed";
	result?: unknown;
};

// Type for tool result data
type ToolResult = {
	success: boolean;
	data?: unknown;
	error?: string;
};

// Render visual component for tool results based on tool name
function renderToolResult(toolName: string, result: ToolResult) {
	if (!result.success || !result.data) {
		return null; // Will fall back to JSON display
	}

	switch (toolName) {
		case "listWorkspaces": {
			// Data is array of {project, workspaces}
			const groups = result.data as WorkspaceGroup[];
			if (!Array.isArray(groups) || groups.length === 0) {
				return (
					<div className="p-3 text-sm text-muted-foreground">
						No workspaces found
					</div>
				);
			}
			return <WorkspaceList groups={groups} />;
		}

		case "getActiveWorkspace": {
			const workspace = result.data as Workspace & {
				project?: { id: string; name: string } | null;
				worktreePath?: string;
			};
			if (!workspace) {
				return (
					<div className="p-3 text-sm text-muted-foreground">
						No active workspace
					</div>
				);
			}
			return <ActiveWorkspaceCard workspace={workspace} />;
		}

		case "switchWorkspace": {
			const data = result.data as {
				message: string;
				workspaceId: string;
				branch: string;
			};
			return (
				<div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-sm">
					<div className="flex items-center gap-2 text-green-600">
						<span>✓</span>
						<span>{data.message}</span>
					</div>
				</div>
			);
		}

		default:
			return null; // Fall back to JSON display
	}
}

export function ChatPanel() {
	const { togglePanel } = useChatPanelStore();
	const {
		messages,
		isLoading,
		error,
		addUserMessage,
		startAssistantMessage,
		appendToAssistantMessage,
		finishAssistantMessage,
		setError,
		setLoading,
		clearMessages,
	} = useChatMessagesStore();

	const scrollRef = useRef<HTMLDivElement>(null);
	const assistantIdRef = useRef<string | null>(null);

	// Track pending messages for the subscription
	const [pendingMessages, setPendingMessages] = useState<
		Array<{ id: string; role: "user" | "assistant"; content: string }>
	>([]);
	const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);
	const [toolCalls, setToolCalls] = useState<ToolCallState[]>([]);

	// Handle streaming data
	const handleStreamData = (data: ChatStreamEvent) => {
		console.log("[ChatPanel] Stream event:", data.type, data);

		if (data.type === "text-delta" && data.content && assistantIdRef.current) {
			appendToAssistantMessage(assistantIdRef.current, data.content);
		} else if (data.type === "tool-call") {
			console.log("[ChatPanel] Tool call received:", data.toolCall);
			// Track tool call for UI display
			setToolCalls((prev) => [
				...prev,
				{ ...data.toolCall, status: "pending" },
			]);
		} else if (data.type === "tool-result") {
			console.log("[ChatPanel] Tool result received:", data.result);
			// Update tool call with result
			setToolCalls((prev) =>
				prev.map((tc) =>
					tc.toolCallId === data.toolCallId
						? { ...tc, status: "completed", result: data.result }
						: tc,
				),
			);
			// Append tool result summary to assistant message
			if (assistantIdRef.current) {
				const result = data.result as {
					success: boolean;
					data?: unknown;
					error?: string;
				};
				const summary = result.success
					? `\n\n✓ Tool completed successfully`
					: `\n\n✗ Tool failed: ${result.error}`;
				appendToAssistantMessage(assistantIdRef.current, summary);
			}
		} else if (data.type === "finish" && assistantIdRef.current) {
			finishAssistantMessage(assistantIdRef.current);
			assistantIdRef.current = null;
			setSubscriptionEnabled(false);
			// Don't clear tool calls on finish - keep them visible
		} else if (data.type === "error") {
			setError(data.error);
			assistantIdRef.current = null;
			setSubscriptionEnabled(false);
		}
	};

	// Subscribe to chat stream
	trpc.chat.sendMessage.useSubscription(
		{ messages: pendingMessages },
		{
			enabled: subscriptionEnabled && pendingMessages.length > 0,
			onData: handleStreamData,
			onError: (err) => {
				console.error("[chat] Subscription error:", err);
				setError(err.message);
				assistantIdRef.current = null;
				setSubscriptionEnabled(false);
			},
		},
	);

	// Auto-scroll to bottom on new messages
	const messagesLength = messages.length;
	const lastMessageContent = messages[messages.length - 1]?.content;
	// biome-ignore lint/correctness/useExhaustiveDependencies: we want to scroll on message changes
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messagesLength, lastMessageContent]);

	const handleSubmit = (message: PromptInputMessage) => {
		const text = message.text.trim();
		if (!text || isLoading) return;

		// Clear previous tool calls when starting new message
		setToolCalls([]);

		// Add user message
		addUserMessage(text);
		const assistantId = startAssistantMessage();
		assistantIdRef.current = assistantId;

		// Build messages array for API
		const allMessages = [
			...messages.map((m) => ({ id: m.id, role: m.role, content: m.content })),
			{ id: "temp", role: "user" as const, content: text },
		];

		// Trigger subscription
		setPendingMessages(allMessages);
		setSubscriptionEnabled(true);
	};

	const handleClear = () => {
		setSubscriptionEnabled(false);
		assistantIdRef.current = null;
		clearMessages();
		setToolCalls([]);
	};

	const handleStop = () => {
		setSubscriptionEnabled(false);
		if (assistantIdRef.current) {
			finishAssistantMessage(assistantIdRef.current);
			assistantIdRef.current = null;
		}
		setLoading(false);
		// Keep tool calls visible after stopping
	};

	// Map our loading state to AI SDK ChatStatus
	const chatStatus = isLoading ? "streaming" : "ready";

	return (
		<div className="flex flex-col h-full border-l border-border bg-background">
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2 border-b border-border">
				<span className="text-xs font-medium text-muted-foreground">Chat</span>
				<div className="flex items-center gap-1">
					{messages.length > 0 && (
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="size-6"
									onClick={handleClear}
								>
									<LuRotateCcw className="size-3" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="bottom">New conversation</TooltipContent>
						</Tooltip>
					)}
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="size-6"
								onClick={togglePanel}
							>
								<LuX className="size-3.5" />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom">
							<HotkeyTooltipContent
								label="Close"
								hotkeyId="TOGGLE_CHAT_PANEL"
							/>
						</TooltipContent>
					</Tooltip>
				</div>
			</div>

			{/* Messages */}
			<div ref={scrollRef} className="flex-1 overflow-y-auto">
				{messages.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full p-6 text-center">
						<p className="text-xs text-muted-foreground">
							Ask about your code, tasks, or workflow
						</p>
					</div>
				) : (
					<div className="p-3 space-y-4">
						{messages.map((message) => (
							<Message key={message.id} from={message.role}>
								<MessageContent>
									{message.role === "user" ? (
										<div className="whitespace-pre-wrap">{message.content}</div>
									) : (
										<>
											{message.content ? (
												<MessageResponse>{message.content}</MessageResponse>
											) : null}
											{message.isStreaming && message.content === "" && (
												<Loader size={14} />
											)}
										</>
									)}
								</MessageContent>
							</Message>
						))}

						{/* Active tool calls */}
						{toolCalls.length > 0 && (
							<div className="space-y-3">
								{toolCalls.map((tc) => {
									const toolState =
										tc.status === "pending"
											? "input-available"
											: "output-available";
									const result = tc.result as ToolResult | undefined;

									// Try to render a visual component for the result
									const visualResult =
										tc.status === "completed" && result
											? renderToolResult(tc.toolName, result)
											: null;

									return (
										<div key={tc.toolCallId} className="space-y-2">
											<Tool>
												<ToolHeader
													title={tc.toolName}
													type="tool-invocation"
													state={toolState}
												/>
												<ToolContent>
													<ToolInput input={tc.args} />
													{tc.status === "completed" &&
														result &&
														!visualResult && (
															<ToolOutput
																output={result.data}
																errorText={result.error}
															/>
														)}
												</ToolContent>
											</Tool>
											{/* Render visual result outside the collapsible Tool */}
											{visualResult}
										</div>
									);
								})}
							</div>
						)}
					</div>
				)}

				{/* Error display */}
				{error && (
					<div className="mx-3 mb-3 p-2 rounded-md bg-destructive/10 text-destructive text-xs">
						{error}
					</div>
				)}
			</div>

			{/* Input - using ai-elements PromptInput */}
			<div className="p-3 border-t border-border">
				<PromptInput onSubmit={handleSubmit} className="w-full">
					<PromptInputTextarea
						placeholder="Ask about your code, tasks, or workflow..."
						className="min-h-[60px] max-h-[120px]"
					/>
					<PromptInputFooter>
						<span className="text-[10px] text-muted-foreground">
							Enter to send
						</span>
						<PromptInputSubmit
							status={chatStatus}
							disabled={isLoading}
							onClick={isLoading ? handleStop : undefined}
						/>
					</PromptInputFooter>
				</PromptInput>
			</div>
		</div>
	);
}
