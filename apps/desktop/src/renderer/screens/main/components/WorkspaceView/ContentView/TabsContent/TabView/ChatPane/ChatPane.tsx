import type { BetaContentBlock, ToolResult } from "@superset/ai-chat/stream";
import { useChatSession } from "@superset/ai-chat/stream";
import {
	Conversation,
	ConversationContent,
	ConversationEmptyState,
	ConversationScrollButton,
} from "@superset/ui/ai-elements/conversation";
import {
	Message,
	MessageContent,
	MessageResponse,
} from "@superset/ui/ai-elements/message";
import {
	PromptInput,
	PromptInputSubmit,
	PromptInputTextarea,
} from "@superset/ui/ai-elements/prompt-input";
import { MessageCircle, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MosaicBranch } from "react-mosaic-component";
import { env } from "renderer/env.renderer";
import { authClient } from "renderer/lib/auth-client";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useTabsStore } from "renderer/stores/tabs/store";
import type { Tab } from "renderer/stores/tabs/types";
import { BasePaneWindow, PaneToolbarActions } from "../components";

interface ChatPaneProps {
	paneId: string;
	path: MosaicBranch[];
	isActive: boolean;
	tabId: string;
	splitPaneAuto: (
		tabId: string,
		sourcePaneId: string,
		dimensions: { width: number; height: number },
		path?: MosaicBranch[],
	) => void;
	splitPaneHorizontal: (
		tabId: string,
		sourcePaneId: string,
		path?: MosaicBranch[],
	) => void;
	splitPaneVertical: (
		tabId: string,
		sourcePaneId: string,
		path?: MosaicBranch[],
	) => void;
	removePane: (paneId: string) => void;
	setFocusedPane: (tabId: string, paneId: string) => void;
	availableTabs: Tab[];
	onMoveToTab: (targetTabId: string) => void;
	onMoveToNewTab: () => void;
}

function getMostRecentWorkspacePath(
	groups: Array<{
		workspaces: Array<{
			worktreePath: string;
			lastOpenedAt: number;
		}>;
	}>,
): string | null {
	const allWorkspaces = groups.flatMap((g) => g.workspaces);
	if (allWorkspaces.length === 0) return null;
	const sorted = [...allWorkspaces].sort(
		(a, b) => b.lastOpenedAt - a.lastOpenedAt,
	);
	return sorted[0].worktreePath || null;
}

function ChatMessageBlock({
	messageRole,
	content,
	contentBlocks,
	toolResults: _toolResults,
	isStreaming,
}: {
	messageRole: "user" | "assistant";
	content: string;
	contentBlocks?: BetaContentBlock[];
	toolResults?: Map<string, ToolResult>;
	isStreaming?: boolean;
}) {
	if (messageRole === "user") {
		return (
			<Message from="user">
				<MessageContent>{content}</MessageContent>
			</Message>
		);
	}

	const textContent =
		contentBlocks
			?.filter(
				(b): b is BetaContentBlock & { type: "text" } => b.type === "text",
			)
			.map((b) => b.text)
			.join("\n") || content;

	return (
		<Message from="assistant">
			<MessageContent>
				<MessageResponse>{textContent}</MessageResponse>
				{isStreaming && (
					<span className="inline-block h-4 w-1 animate-pulse bg-current" />
				)}
			</MessageContent>
		</Message>
	);
}

export function ChatPane({
	paneId,
	path,
	isActive,
	tabId,
	splitPaneAuto,
	splitPaneHorizontal: _splitPaneHorizontal,
	splitPaneVertical: _splitPaneVertical,
	removePane,
	setFocusedPane,
	availableTabs: _availableTabs,
	onMoveToTab: _onMoveToTab,
	onMoveToNewTab: _onMoveToNewTab,
}: ChatPaneProps) {
	const sessionId = useTabsStore((s) => s.panes[paneId]?.chat?.sessionId);
	const paneName = useTabsStore((s) => s.panes[paneId]?.name);

	const { data: session } = authClient.useSession();
	const user = session?.user
		? { userId: session.user.id, name: session.user.name ?? "Unknown" }
		: null;

	const { messages, streamingMessage, draft, setDraft, sendMessage } =
		useChatSession({
			proxyUrl: env.NEXT_PUBLIC_STREAMS_URL,
			sessionId: sessionId ?? "",
			user,
			autoConnect: !!user && !!sessionId,
		});

	const startSessionMutation = electronTrpc.aiChat.startSession.useMutation();
	const { data: isSessionActive, refetch: refetchIsActive } =
		electronTrpc.aiChat.isSessionActive.useQuery(
			{ sessionId: sessionId ?? "" },
			{ enabled: !!sessionId },
		);

	const { data: workspaceGroups } =
		electronTrpc.workspaces.getAllGrouped.useQuery();
	const mostRecentWorkspacePath = useMemo(
		() =>
			workspaceGroups ? getMostRecentWorkspacePath(workspaceGroups) : null,
		[workspaceGroups],
	);

	// Auto-start session when pane mounts and session is not active
	const hasAutoStarted = useRef(false);
	useEffect(() => {
		if (
			hasAutoStarted.current ||
			!sessionId ||
			isSessionActive ||
			isSessionActive === undefined ||
			!mostRecentWorkspacePath ||
			startSessionMutation.isPending
		) {
			return;
		}

		hasAutoStarted.current = true;
		startSessionMutation
			.mutateAsync({ sessionId, cwd: mostRecentWorkspacePath })
			.then(() => refetchIsActive())
			.catch((err) =>
				console.error("[ChatPane] Failed to auto-start session:", err),
			);
	}, [
		sessionId,
		isSessionActive,
		mostRecentWorkspacePath,
		startSessionMutation,
		refetchIsActive,
	]);

	const [isSending, setIsSending] = useState(false);
	const handleSend = useCallback(
		async (content: string) => {
			setIsSending(true);
			setDraft("");
			try {
				await sendMessage(content);
			} finally {
				setIsSending(false);
			}
		},
		[sendMessage, setDraft],
	);

	const renderToolbar = useCallback(
		(handlers: {
			splitOrientation: "horizontal" | "vertical";
			onSplitPane: (e: React.MouseEvent) => void;
			onClosePane: (e: React.MouseEvent) => void;
		}) => (
			<div className="flex h-full w-full items-center justify-between px-3">
				<div className="flex items-center gap-2 text-muted-foreground">
					<MessageCircle className="size-4" />
					<span className="text-sm truncate max-w-[150px]">
						{paneName ?? "Chat"}
					</span>
				</div>
				<PaneToolbarActions
					splitOrientation={handlers.splitOrientation}
					onSplitPane={handlers.onSplitPane}
					onClosePane={handlers.onClosePane}
					closeHotkeyId="CLOSE_TERMINAL"
				/>
			</div>
		),
		[paneName],
	);

	if (!sessionId) {
		return (
			<BasePaneWindow
				paneId={paneId}
				path={path}
				tabId={tabId}
				isActive={isActive}
				splitPaneAuto={splitPaneAuto}
				removePane={removePane}
				setFocusedPane={setFocusedPane}
				renderToolbar={renderToolbar}
			>
				<div className="flex h-full items-center justify-center text-muted-foreground">
					Session not found
				</div>
			</BasePaneWindow>
		);
	}

	const hasMessages = messages.length > 0 || !!streamingMessage;

	return (
		<BasePaneWindow
			paneId={paneId}
			path={path}
			tabId={tabId}
			isActive={isActive}
			splitPaneAuto={splitPaneAuto}
			removePane={removePane}
			setFocusedPane={setFocusedPane}
			renderToolbar={renderToolbar}
		>
			<div className="flex flex-col h-full">
				<Conversation className="flex-1 min-h-0">
					{hasMessages ? (
						<ConversationContent>
							{messages.map((m) => (
								<ChatMessageBlock
									key={m.id}
									messageRole={m.role as "user" | "assistant"}
									content={m.content}
									contentBlocks={m.contentBlocks}
									toolResults={m.toolResults}
								/>
							))}
							{streamingMessage && (
								<ChatMessageBlock
									messageRole="assistant"
									content={streamingMessage.content}
									contentBlocks={streamingMessage.contentBlocks}
									toolResults={streamingMessage.toolResults}
									isStreaming
								/>
							)}
						</ConversationContent>
					) : (
						<ConversationEmptyState
							icon={<Sparkles className="size-8" />}
							title="Start a conversation"
							description="Ask anything to get started"
						/>
					)}
					<ConversationScrollButton />
				</Conversation>

				<div className="border-t border-border p-3">
					<PromptInput
						onSubmit={({ text }) => {
							if (text.trim()) {
								handleSend(text);
							}
						}}
					>
						<PromptInputTextarea
							value={draft}
							onChange={(e) => setDraft(e.currentTarget.value)}
							placeholder="Type a message..."
							disabled={!isSessionActive || isSending}
							className="min-h-10"
						/>
						<PromptInputSubmit
							disabled={!isSessionActive || isSending || !draft.trim()}
						/>
					</PromptInput>
				</div>
			</div>
		</BasePaneWindow>
	);
}
