import { initTRPC } from "@trpc/server";
import { z } from "zod";
import type { AgentManager } from "../agent/agent-manager";
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

export function createChatServiceRouter(deps: {
	agentManager: AgentManager | null;
	resolveWorkspaceRootPath: (workspaceId: string) => Promise<string | null>;
}) {
	return t.router({
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
					active: deps.agentManager?.hasWatcher(input.sessionId) ?? false,
				};
			}),

			activate: t.procedure.input(sessionIdInput).mutation(({ input }) => {
				deps.agentManager?.ensureWatcher(input.sessionId);
				return { active: true };
			}),
		}),
	});
}

export type ChatServiceRouter = ReturnType<typeof createChatServiceRouter>;
