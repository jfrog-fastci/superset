import { ChatService } from "@superset/chat-service";
import { createChatServiceRouter as buildRouter } from "@superset/chat-service/router";
import { env } from "main/env.main";
import { getHashedDeviceId } from "main/lib/device-info";

const service = new ChatService({
	deviceId: getHashedDeviceId(),
	electricUrl: env.NEXT_PUBLIC_ELECTRIC_URL ?? "",
	apiUrl: env.NEXT_PUBLIC_API_URL ?? "",
});

if (env.NODE_ENV === "development") {
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

export const createChatServiceRouter = () => buildRouter(service);

export type ChatServiceDesktopRouter = ReturnType<
	typeof createChatServiceRouter
>;
