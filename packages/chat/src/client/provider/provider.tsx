import { createTRPCReact } from "@trpc/react-query";
import type { ChatServiceRouter } from "../../host/router/router";

export type ChatServiceEndpoint =
	| { type: "electron" }
	| { type: "http"; url: string };

export const chatServiceTrpc = createTRPCReact<ChatServiceRouter>();

export const ChatServiceProvider = chatServiceTrpc.Provider;
export const useChatService = chatServiceTrpc;
