"use client";

import { Button } from "@superset/ui/button";
import { Textarea } from "@superset/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
import { useEffect, useRef, useState } from "react";
import { LuCornerDownLeft, LuRotateCcw, LuSquare, LuX } from "react-icons/lu";
import { HotkeyTooltipContent } from "renderer/components/HotkeyTooltipContent";
import { trpc } from "renderer/lib/trpc";
import { useChatMessagesStore, useChatPanelStore } from "renderer/stores";

type ChatStreamEvent =
	| { type: "text-delta"; content: string }
	| { type: "finish"; finishReason: string }
	| { type: "error"; error: string };

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
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const assistantIdRef = useRef<string | null>(null);

	// Track pending messages for the subscription
	const [pendingMessages, setPendingMessages] = useState<
		Array<{ id: string; role: "user" | "assistant"; content: string }>
	>([]);
	const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);

	// Handle streaming data
	const handleStreamData = (data: ChatStreamEvent) => {
		if (data.type === "text-delta" && data.content && assistantIdRef.current) {
			appendToAssistantMessage(assistantIdRef.current, data.content);
		} else if (data.type === "finish" && assistantIdRef.current) {
			finishAssistantMessage(assistantIdRef.current);
			assistantIdRef.current = null;
			setSubscriptionEnabled(false);
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
	const _messagesLength = messages.length;
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, []);

	// Focus textarea on mount
	useEffect(() => {
		textareaRef.current?.focus();
	}, []);

	const handleSubmit = () => {
		const text = textareaRef.current?.value.trim();
		if (!text || isLoading) return;

		// Clear input
		if (textareaRef.current) {
			textareaRef.current.value = "";
		}

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

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	};

	const handleClear = () => {
		setSubscriptionEnabled(false);
		assistantIdRef.current = null;
		clearMessages();
		textareaRef.current?.focus();
	};

	const handleStop = () => {
		setSubscriptionEnabled(false);
		if (assistantIdRef.current) {
			finishAssistantMessage(assistantIdRef.current);
			assistantIdRef.current = null;
		}
		setLoading(false);
	};

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
							<div
								key={message.id}
								className={cn(
									"text-sm leading-relaxed",
									message.role === "user"
										? "text-foreground"
										: "text-muted-foreground",
								)}
							>
								<div
									className={cn(
										"text-[10px] font-medium uppercase tracking-wide mb-1",
										message.role === "user"
											? "text-foreground/50"
											: "text-muted-foreground/70",
									)}
								>
									{message.role === "user" ? "You" : "Assistant"}
								</div>
								<div className="whitespace-pre-wrap">{message.content}</div>
								{message.isStreaming && message.content === "" && (
									<div className="flex items-center gap-1 mt-1">
										<span className="size-1.5 rounded-full bg-foreground/40 animate-pulse" />
										<span
											className="size-1.5 rounded-full bg-foreground/40 animate-pulse"
											style={{ animationDelay: "150ms" }}
										/>
										<span
											className="size-1.5 rounded-full bg-foreground/40 animate-pulse"
											style={{ animationDelay: "300ms" }}
										/>
									</div>
								)}
							</div>
						))}
					</div>
				)}

				{/* Error display */}
				{error && (
					<div className="mx-3 mb-3 p-2 rounded-md bg-destructive/10 text-destructive text-xs">
						{error}
					</div>
				)}
			</div>

			{/* Input */}
			<div className="p-3 border-t border-border">
				<div className="relative">
					<Textarea
						ref={textareaRef}
						onKeyDown={handleKeyDown}
						placeholder="Message..."
						disabled={isLoading}
						className={cn(
							"min-h-[60px] max-h-[120px] resize-none pr-10 text-sm",
							"bg-muted/50 border-transparent focus:border-border focus:bg-background",
							"placeholder:text-muted-foreground/50",
						)}
						rows={2}
					/>
					<div className="absolute right-2 bottom-2">
						{isLoading ? (
							<Button
								size="icon"
								variant="ghost"
								className="size-6"
								onClick={handleStop}
							>
								<LuSquare className="size-3" />
							</Button>
						) : (
							<Button
								size="icon"
								variant="ghost"
								className="size-6"
								onClick={handleSubmit}
							>
								<LuCornerDownLeft className="size-3.5" />
							</Button>
						)}
					</div>
				</div>
				<div className="mt-2 text-[10px] text-muted-foreground/50 text-center">
					Enter to send, Shift+Enter for new line
				</div>
			</div>
		</div>
	);
}
