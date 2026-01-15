import { tool } from "ai";
import { z } from "zod";

/**
 * Workspace tool schemas for the orchestration agent.
 *
 * These tools are defined as schemas on the backend but executed on the desktop client.
 * The backend streams tool calls, and the desktop executes them locally
 * because workspace operations require access to the local filesystem and database.
 *
 * We use `execute: undefined` to indicate these are client-executed tools.
 */
export const workspaceTools = {
	listWorkspaces: tool({
		description:
			"List all workspaces across all projects. Returns workspaces grouped by project with details like branch name, type (worktree or branch), and path.",
		inputSchema: z.object({
			projectId: z
				.string()
				.optional()
				.describe("Optional: Filter to a specific project ID"),
		}),
	}),

	getActiveWorkspace: tool({
		description:
			"Get details about the currently active workspace including project name, branch, file path, and worktree information.",
		inputSchema: z.object({}),
	}),

	switchWorkspace: tool({
		description:
			"Switch to a different workspace by its ID. This will change the active workspace in the desktop app.",
		inputSchema: z.object({
			workspaceId: z.string().describe("The ID of the workspace to switch to"),
		}),
	}),

	createWorkspace: tool({
		description:
			"Create a new workspace (git worktree) for a branch. This creates an isolated working directory for parallel development.",
		inputSchema: z.object({
			projectId: z
				.string()
				.describe("The project ID to create the workspace in"),
			branchName: z
				.string()
				.optional()
				.describe(
					"Branch name for the new workspace. Auto-generated if not provided.",
				),
			name: z
				.string()
				.optional()
				.describe("Display name for the workspace in the UI"),
			baseBranch: z
				.string()
				.optional()
				.describe("Base branch to create from (defaults to main)"),
		}),
	}),
};

export type WorkspaceToolName = keyof typeof workspaceTools;
