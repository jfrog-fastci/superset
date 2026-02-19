import { createTRPCReact } from "@trpc/react-query";
import type { ChatServiceRouter } from "../router";

export const chatService = createTRPCReact<ChatServiceRouter>();
