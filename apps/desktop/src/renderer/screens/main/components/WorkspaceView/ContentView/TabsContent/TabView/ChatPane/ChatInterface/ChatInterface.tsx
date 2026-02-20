import { chatServiceTrpc, useChat } from "@superset/chat/client";
import type { PromptInputMessage } from "@superset/ui/ai-elements/prompt-input";
import { PromptInputProvider } from "@superset/ui/ai-elements/prompt-input";
import type { FileUIPart } from "ai";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { env } from "renderer/env.renderer";
import { apiTrpcClient } from "renderer/lib/api-trpc-client";
import { getAuthToken } from "renderer/lib/auth-client";
import { useTabsStore } from "renderer/stores/tabs/store";
import { ChatInputFooter } from "./components/ChatInputFooter";
import { MessageList } from "./components/MessageList";
import { DEFAULT_AVAILABLE_MODELS, DEFAULT_MODEL } from "./constants";
import type { SlashCommand } from "./hooks/useSlashCommands";
import type { ChatInterfaceProps, ModelOption, PermissionMode } from "./types";

const apiUrl = env.NEXT_PUBLIC_API_URL;

function useAvailableModels(): ModelOption[] {
	const [models, setModels] = useState<ModelOption[]>(DEFAULT_AVAILABLE_MODELS);
	useEffect(() => {
		apiTrpcClient.chat.getModels
			.query()
			.then((data) => {
				if (data.models.length) setModels(data.models);
			})
			.catch(() => {});
	}, []);
	return models;
}

function getAuthHeaders(): Record<string, string> {
	const token = getAuthToken();
	return token ? { Authorization: `Bearer ${token}` } : {};
}

async function createSession(
	sessionId: string,
	organizationId: string,
	deviceId: string | null,
	workspaceId?: string,
): Promise<void> {
	const token = getAuthToken();
	await fetch(`${apiUrl}/api/chat/${sessionId}`, {
		method: "PUT",
		headers: {
			"Content-Type": "application/json",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: JSON.stringify({
			organizationId,
			...(deviceId ? { deviceId } : {}),
			...(workspaceId ? { workspaceId } : {}),
		}),
	});
}

async function uploadFile(
	sessionId: string,
	file: FileUIPart,
): Promise<FileUIPart> {
	const response = await fetch(file.url);
	const blob = await response.blob();
	const filename = file.filename || "attachment";

	const formData = new FormData();
	formData.append("file", new File([blob], filename, { type: file.mediaType }));

	const token = getAuthToken();
	const res = await fetch(`${apiUrl}/api/chat/${sessionId}/attachments`, {
		method: "POST",
		headers: token ? { Authorization: `Bearer ${token}` } : {},
		body: formData,
	});

	if (!res.ok) {
		const err = await res.json().catch(() => ({ error: "Upload failed" }));
		throw new Error(err.error || `Upload failed: ${res.status}`);
	}

	const result: { url: string; mediaType: string; filename?: string } =
		await res.json();
	return { type: "file", ...result };
}

export function ChatInterface({
	sessionId,
	organizationId,
	deviceId,
	workspaceId,
	cwd,
	paneId,
}: ChatInterfaceProps) {
	const switchChatSession = useTabsStore((s) => s.switchChatSession);
	const availableModels = useAvailableModels();

	// --- Shared UI state (declared once) ---
	const [selectedModel, setSelectedModel] =
		useState<ModelOption>(DEFAULT_MODEL);
	const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
	const [thinkingEnabled, setThinkingEnabled] = useState(false);
	const [permissionMode, setPermissionMode] =
		useState<PermissionMode>("bypassPermissions");

	// --- Pending message bridge (no-session → session) ---
	const [pendingMessage, setPendingMessage] = useState<string | null>(null);
	const [pendingFiles, setPendingFiles] = useState<FileUIPart[]>([]);

	// --- useChat — always called, inert when sessionId is null ---
	const chat = useChat({
		sessionId,
		proxyUrl: apiUrl,
		getHeaders: getAuthHeaders,
	});

	// --- Slash commands (always active) ---
	const { data: slashCommands = [] } =
		chatServiceTrpc.workspace.getSlashCommands.useQuery({ cwd });

	const activateMutation = chatServiceTrpc.session.activate.useMutation();

	// --- Send pending message once the session is ready ---
	const sentPendingRef = useRef(false);
	useEffect(() => {
		if (!chat.ready || sentPendingRef.current) return;
		if (!pendingMessage && pendingFiles.length === 0) return;
		sentPendingRef.current = true;
		chat.sendMessage(
			pendingMessage ?? "",
			pendingFiles.length > 0 ? pendingFiles : undefined,
		);
		setPendingMessage(null);
		setPendingFiles([]);
	}, [chat.ready, chat.sendMessage, pendingMessage, pendingFiles]);

	// --- Push initial config once session is ready ---
	const registeredRef = useRef(false);
	useEffect(() => {
		if (!chat.ready || registeredRef.current) return;
		registeredRef.current = true;
		chat.metadata.updateConfig({
			model: selectedModel.id,
			permissionMode,
			thinkingEnabled,
			cwd,
		});
	}, [
		chat.ready,
		cwd,
		chat.metadata.updateConfig,
		permissionMode,
		selectedModel.id,
		thinkingEnabled,
	]);

	// Reset refs when sessionId changes so pending/config are re-sent for new sessions
	// biome-ignore lint/correctness/useExhaustiveDependencies: sessionId triggers the reset intentionally
	useEffect(() => {
		sentPendingRef.current = false;
		registeredRef.current = false;
	}, [sessionId]);

	// --- Push config changes after initial registration ---
	const prevConfigRef = useRef({
		modelId: selectedModel.id,
		permissionMode,
		thinkingEnabled,
	});
	useEffect(() => {
		const prev = prevConfigRef.current;
		if (
			prev.modelId === selectedModel.id &&
			prev.permissionMode === permissionMode &&
			prev.thinkingEnabled === thinkingEnabled
		) {
			return;
		}
		prevConfigRef.current = {
			modelId: selectedModel.id,
			permissionMode,
			thinkingEnabled,
		};
		chat.metadata.updateConfig({
			model: selectedModel.id,
			permissionMode,
			thinkingEnabled,
			cwd,
		});
	}, [
		selectedModel.id,
		permissionMode,
		thinkingEnabled,
		cwd,
		chat.metadata.updateConfig,
	]);

	// --- Display messages: show synthetic pending while useChat preloads ---
	const displayMessages =
		chat.messages.length === 0 && (pendingMessage || pendingFiles.length > 0)
			? [
					{
						id: "pending",
						role: "user" as const,
						parts: [
							...(pendingMessage
								? [{ type: "text" as const, text: pendingMessage }]
								: []),
							...pendingFiles,
						],
						createdAt: new Date(),
					},
				]
			: chat.messages;

	// --- Send handler: creates session if needed, otherwise sends directly ---
	const handleSend = useCallback(
		async (message: PromptInputMessage) => {
			const text = message.text.trim();
			const files = message.files ?? [];
			if (!text && files.length === 0) return;

			if (sessionId) {
				// Active session — send directly
				activateMutation.mutate({ sessionId });

				let uploadedFiles: FileUIPart[] | undefined;
				if (files.length > 0) {
					const results = await Promise.all(
						files.map((f) => uploadFile(sessionId, f)),
					);
					uploadedFiles = results;
				}

				chat.sendMessage(text, uploadedFiles);
			} else {
				// No session — create one, then switch (re-renders with sessionId)
				if (!organizationId) return;

				const newSessionId = crypto.randomUUID();
				try {
					await createSession(
						newSessionId,
						organizationId,
						deviceId,
						workspaceId,
					);

					// Config is fire-and-forget
					fetch(`${apiUrl}/api/chat/${newSessionId}/stream/config`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							...getAuthHeaders(),
						},
						body: JSON.stringify({
							model: selectedModel.id,
							permissionMode,
							thinkingEnabled,
							cwd,
						}),
					});

					// Upload files immediately
					let uploadedFiles: FileUIPart[] = [];
					if (files.length > 0) {
						uploadedFiles = await Promise.all(
							files.map((f) => uploadFile(newSessionId, f)),
						);
					}

					setPendingMessage(text);
					setPendingFiles(uploadedFiles);
					switchChatSession(paneId, newSessionId);
				} catch {
					// Session creation failed — don't navigate
				}
			}
		},
		[
			sessionId,
			organizationId,
			deviceId,
			workspaceId,
			paneId,
			switchChatSession,
			activateMutation,
			chat.sendMessage,
			selectedModel.id,
			permissionMode,
			thinkingEnabled,
			cwd,
		],
	);

	const handleStop = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			chat.stop();
		},
		[chat.stop],
	);

	const handleSlashCommandSend = useCallback(
		(command: SlashCommand) => {
			handleSend({ text: `/${command.name}`, files: [] });
		},
		[handleSend],
	);

	const isStreaming = chat.isLoading || !!pendingMessage;

	return (
		<PromptInputProvider>
			<div className="flex h-full flex-col bg-background">
				<MessageList
					messages={displayMessages}
					isStreaming={isStreaming}
					workspaceId={workspaceId}
				/>
				<ChatInputFooter
					cwd={cwd}
					error={chat.error}
					isStreaming={isStreaming}
					availableModels={availableModels}
					selectedModel={selectedModel}
					setSelectedModel={setSelectedModel}
					modelSelectorOpen={modelSelectorOpen}
					setModelSelectorOpen={setModelSelectorOpen}
					permissionMode={permissionMode}
					setPermissionMode={setPermissionMode}
					thinkingEnabled={thinkingEnabled}
					setThinkingEnabled={setThinkingEnabled}
					slashCommands={slashCommands}
					onSend={handleSend}
					onStop={handleStop}
					onSlashCommandSend={handleSlashCommandSend}
				/>
			</div>
		</PromptInputProvider>
	);
}
