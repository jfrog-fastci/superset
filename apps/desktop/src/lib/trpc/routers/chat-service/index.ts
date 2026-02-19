import {
	AgentManager,
	type AgentManagerConfig,
	searchFiles,
} from "@superset/chat-service";
import { env } from "main/env.main";
import { getHashedDeviceId } from "main/lib/device-info";
import { z } from "zod";
import { publicProcedure, router } from "../..";

let agentManager: AgentManager | null = null;

export const createChatServiceRouter = () => {
	return router({
		start: publicProcedure
			.input(z.object({ organizationId: z.string(), authToken: z.string() }))
			.mutation(async ({ input }) => {
				const deviceId = getHashedDeviceId();

				const config: AgentManagerConfig = {
					deviceId,
					organizationId: input.organizationId,
					authToken: input.authToken,
					electricUrl: env.NEXT_PUBLIC_ELECTRIC_URL ?? "",
					apiUrl: env.NEXT_PUBLIC_API_URL ?? "",
				};

				if (agentManager) {
					await agentManager.restart({
						organizationId: input.organizationId,
						deviceId,
						authToken: input.authToken,
					});
				} else {
					agentManager = new AgentManager(config);

					// In development, localhost uses self-signed certs that Node.js rejects
					if (env.NODE_ENV === "development") {
						process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
					}

					await agentManager.start();
				}

				return { success: true };
			}),

		stop: publicProcedure.mutation(() => {
			if (agentManager) {
				agentManager.stop();
				agentManager = null;
			}
			return { success: true };
		}),

		workspace: router({
			searchFiles: publicProcedure
				.input(
					z.object({
						rootPath: z.string(),
						query: z.string(),
						includeHidden: z.boolean().default(false),
						limit: z.number().default(20),
					}),
				)
				.query(async ({ input }) => {
					return searchFiles({
						rootPath: input.rootPath,
						query: input.query,
						includeHidden: input.includeHidden,
						limit: input.limit,
					});
				}),
		}),

		session: router({
			isActive: publicProcedure
				.input(z.object({ sessionId: z.string().uuid() }))
				.query(({ input }) => {
					return {
						active: agentManager?.hasWatcher(input.sessionId) ?? false,
					};
				}),

			activate: publicProcedure
				.input(z.object({ sessionId: z.string().uuid() }))
				.mutation(({ input }) => {
					agentManager?.ensureWatcher(input.sessionId);
					return { active: true };
				}),
		}),
	});
};

export type ChatServiceDesktopRouter = ReturnType<
	typeof createChatServiceRouter
>;
