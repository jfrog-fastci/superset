import { initTRPC } from "@trpc/server";
import { z } from "zod";
import type { ChatService } from "../chat-service";
import { searchFiles } from "../workspace/file-search";
import { getSlashCommands } from "../workspace/slash-commands";

const t = initTRPC.create();

export const searchFilesInput = z.object({
	rootPath: z.string(),
	query: z.string(),
	includeHidden: z.boolean().default(false),
	limit: z.number().default(20),
});

export const getSlashCommandsInput = z.object({
	workspaceId: z.string().uuid(),
});

export const sessionIdInput = z.object({
	sessionId: z.string().uuid(),
});

export function createChatServiceRouter(service: ChatService) {
	return t.router({
		start: t.procedure
			.input(z.object({ organizationId: z.string(), authToken: z.string() }))
			.mutation(async ({ input }) => {
				await service.start(input);
				return { success: true };
			}),

		stop: t.procedure.mutation(() => {
			service.stop();
			return { success: true };
		}),

		workspace: t.router({
			searchFiles: t.procedure
				.input(searchFilesInput)
				.query(async ({ input }) => {
					return searchFiles({
						rootPath: input.rootPath,
						query: input.query,
						includeHidden: input.includeHidden,
						limit: input.limit,
					});
				}),

			getSlashCommands: t.procedure
				.input(getSlashCommandsInput)
				.query(async ({ input }) => {
					return getSlashCommands(input.workspaceId);
				}),
		}),

		session: t.router({
			isActive: t.procedure.input(sessionIdInput).query(({ input }) => {
				return {
					active: service.hasWatcher(input.sessionId),
				};
			}),

			activate: t.procedure.input(sessionIdInput).mutation(({ input }) => {
				service.ensureWatcher(input.sessionId);
				return { active: true };
			}),
		}),
	});
}

export type ChatServiceRouter = ReturnType<typeof createChatServiceRouter>;
