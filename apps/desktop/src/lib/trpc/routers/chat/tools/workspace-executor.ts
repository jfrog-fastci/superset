import { projects, settings, workspaces, worktrees } from "@superset/local-db";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { localDb } from "main/lib/local-db";

/**
 * Workspace tool executor for the orchestration agent.
 *
 * These functions are called when the LLM invokes workspace tools.
 * They use the same database operations as the tRPC workspace procedures.
 */

export type WorkspaceToolName =
	| "listWorkspaces"
	| "getActiveWorkspace"
	| "switchWorkspace"
	| "createWorkspace";

export type ToolResult = {
	success: boolean;
	data?: unknown;
	error?: string;
};

/**
 * List all workspaces across all projects
 */
export async function listWorkspaces(params: {
	projectId?: string;
}): Promise<ToolResult> {
	try {
		const activeProjects = localDb
			.select()
			.from(projects)
			.where(isNotNull(projects.tabOrder))
			.all();

		const allWorktrees = localDb.select().from(worktrees).all();
		const worktreePathMap = new Map(allWorktrees.map((wt) => [wt.id, wt.path]));

		const result: Array<{
			project: { id: string; name: string };
			workspaces: Array<{
				id: string;
				name: string;
				branch: string;
				type: "worktree" | "branch";
				path: string;
			}>;
		}> = [];

		for (const project of activeProjects) {
			// Filter by projectId if provided
			if (params.projectId && project.id !== params.projectId) {
				continue;
			}

			const projectWorkspaces = localDb
				.select()
				.from(workspaces)
				.where(
					and(
						eq(workspaces.projectId, project.id),
						isNull(workspaces.deletingAt),
					),
				)
				.all()
				.sort((a, b) => a.tabOrder - b.tabOrder);

			const workspaceList = projectWorkspaces.map((ws) => {
				let path = "";
				if (ws.type === "worktree" && ws.worktreeId) {
					path = worktreePathMap.get(ws.worktreeId) ?? "";
				} else if (ws.type === "branch") {
					path = project.mainRepoPath;
				}

				return {
					id: ws.id,
					name: ws.name,
					branch: ws.branch,
					type: ws.type as "worktree" | "branch",
					path,
				};
			});

			result.push({
				project: { id: project.id, name: project.name },
				workspaces: workspaceList,
			});
		}

		return { success: true, data: result };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Failed to list workspaces",
		};
	}
}

/**
 * Get the currently active workspace
 */
export async function getActiveWorkspace(): Promise<ToolResult> {
	try {
		const settingsRow = localDb.select().from(settings).get();
		const lastActiveWorkspaceId = settingsRow?.lastActiveWorkspaceId;

		if (!lastActiveWorkspaceId) {
			return { success: true, data: null };
		}

		const workspace = localDb
			.select()
			.from(workspaces)
			.where(
				and(
					eq(workspaces.id, lastActiveWorkspaceId),
					isNull(workspaces.deletingAt),
				),
			)
			.get();

		if (!workspace) {
			return { success: true, data: null };
		}

		const project = localDb
			.select()
			.from(projects)
			.where(eq(projects.id, workspace.projectId))
			.get();

		const worktree = workspace.worktreeId
			? localDb
					.select()
					.from(worktrees)
					.where(eq(worktrees.id, workspace.worktreeId))
					.get()
			: null;

		return {
			success: true,
			data: {
				id: workspace.id,
				name: workspace.name,
				branch: workspace.branch,
				type: workspace.type,
				project: project ? { id: project.id, name: project.name } : null,
				worktreePath: worktree?.path ?? project?.mainRepoPath ?? "",
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Failed to get active workspace",
		};
	}
}

/**
 * Switch to a different workspace
 */
export async function switchWorkspace(params: {
	workspaceId: string;
}): Promise<ToolResult> {
	try {
		const workspace = localDb
			.select()
			.from(workspaces)
			.where(
				and(
					eq(workspaces.id, params.workspaceId),
					isNull(workspaces.deletingAt),
				),
			)
			.get();

		if (!workspace) {
			return {
				success: false,
				error: `Workspace ${params.workspaceId} not found`,
			};
		}

		// Update last active workspace
		localDb
			.update(settings)
			.set({ lastActiveWorkspaceId: params.workspaceId })
			.run();

		// Clear unread and update last opened
		localDb
			.update(workspaces)
			.set({
				isUnread: false,
				lastOpenedAt: Date.now(),
				updatedAt: Date.now(),
			})
			.where(eq(workspaces.id, params.workspaceId))
			.run();

		return {
			success: true,
			data: {
				message: `Switched to workspace "${workspace.name}"`,
				workspaceId: workspace.id,
				branch: workspace.branch,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Failed to switch workspace",
		};
	}
}

/**
 * Create a new workspace (worktree)
 * Note: This initiates creation but doesn't wait for full initialization
 */
export async function createWorkspace(_params: {
	projectId: string;
	branchName?: string;
	name?: string;
	baseBranch?: string;
}): Promise<ToolResult> {
	// For now, return a message indicating this requires the full workspace creation flow
	// Full implementation would call workspaceInitManager similar to the create procedure
	return {
		success: false,
		error:
			"Workspace creation through chat is not yet fully implemented. Please use the workspace creation UI.",
	};
}

/**
 * Execute a workspace tool by name
 */
export async function executeWorkspaceTool(
	toolName: WorkspaceToolName,
	args: Record<string, unknown>,
): Promise<ToolResult> {
	switch (toolName) {
		case "listWorkspaces":
			return listWorkspaces(args as { projectId?: string });
		case "getActiveWorkspace":
			return getActiveWorkspace();
		case "switchWorkspace":
			return switchWorkspace(args as { workspaceId: string });
		case "createWorkspace":
			return createWorkspace(
				args as {
					projectId: string;
					branchName?: string;
					name?: string;
					baseBranch?: string;
				},
			);
		default:
			return { success: false, error: `Unknown tool: ${toolName}` };
	}
}
