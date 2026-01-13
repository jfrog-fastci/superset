import { create } from "zustand";
import { devtools } from "zustand/middleware";

export interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	isStreaming?: boolean;
}

interface ChatMessagesState {
	messages: ChatMessage[];
	isLoading: boolean;
	error: string | null;

	addUserMessage: (content: string) => string;
	startAssistantMessage: () => string;
	appendToAssistantMessage: (id: string, content: string) => void;
	finishAssistantMessage: (id: string) => void;
	setError: (error: string | null) => void;
	setLoading: (loading: boolean) => void;
	clearMessages: () => void;
}

let messageCounter = 0;
const generateId = () => `msg-${Date.now()}-${++messageCounter}`;

export const useChatMessagesStore = create<ChatMessagesState>()(
	devtools(
		(set) => ({
			messages: [],
			isLoading: false,
			error: null,

			addUserMessage: (content) => {
				const id = generateId();
				set((state) => ({
					messages: [...state.messages, { id, role: "user", content }],
					isLoading: true,
					error: null,
				}));
				return id;
			},

			startAssistantMessage: () => {
				const id = generateId();
				set((state) => ({
					messages: [
						...state.messages,
						{ id, role: "assistant", content: "", isStreaming: true },
					],
				}));
				return id;
			},

			appendToAssistantMessage: (id, content) => {
				set((state) => ({
					messages: state.messages.map((m) =>
						m.id === id ? { ...m, content: m.content + content } : m,
					),
				}));
			},

			finishAssistantMessage: (id) => {
				set((state) => ({
					messages: state.messages.map((m) =>
						m.id === id ? { ...m, isStreaming: false } : m,
					),
					isLoading: false,
				}));
			},

			setError: (error) => set({ error, isLoading: false }),
			setLoading: (loading) => set({ isLoading: loading }),
			clearMessages: () => set({ messages: [], error: null, isLoading: false }),
		}),
		{ name: "ChatMessagesStore" },
	),
);
