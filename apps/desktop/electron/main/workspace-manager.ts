import { randomUUID } from "node:crypto";
import configManager from "./config-manager";
import worktreeManager from "./worktree-manager";

export interface Workspace {
	id: string;
	name: string;
	repoPath: string;
	branch: string;
	layout: unknown;
	createdAt: string;
	updatedAt: string;
}

export interface CreateWorkspaceInput {
	name: string;
	repoPath: string;
	branch: string;
	layout: unknown;
	createBranch?: boolean;
}

export interface UpdateWorkspaceInput {
	id: string;
	name?: string;
	layout?: unknown;
}

class WorkspaceManager {
	private static instance: WorkspaceManager;

	private constructor() {}

	static getInstance(): WorkspaceManager {
		if (!WorkspaceManager.instance) {
			WorkspaceManager.instance = new WorkspaceManager();
		}
		return WorkspaceManager.instance;
	}

	/**
	 * Get all workspaces
	 */
	async list(): Promise<Workspace[]> {
		const config = configManager.read();
		return config.workspaces;
	}

	/**
	 * Get a workspace by ID
	 */
	async get(id: string): Promise<Workspace | null> {
		const config = configManager.read();
		return config.workspaces.find((ws) => ws.id === id) || null;
	}

	/**
	 * Create a new workspace
	 */
	async create(
		input: CreateWorkspaceInput,
	): Promise<{ success: boolean; workspace?: Workspace; error?: string }> {
		try {
			// Validate that repoPath is a git repository
			if (!worktreeManager.isGitRepo(input.repoPath)) {
				return {
					success: false,
					error: "The specified path is not a git repository",
				};
			}

			// Create worktree
			const worktreeResult = await worktreeManager.createWorktree(
				input.repoPath,
				input.branch,
				input.createBranch || false,
			);

			if (!worktreeResult.success) {
				return {
					success: false,
					error: `Failed to create worktree: ${worktreeResult.error}`,
				};
			}

			// Create workspace object
			const now = new Date().toISOString();
			const workspace: Workspace = {
				id: randomUUID(),
				name: input.name,
				repoPath: input.repoPath,
				branch: input.branch,
				layout: input.layout,
				createdAt: now,
				updatedAt: now,
			};

			// Save to config
			const config = configManager.read();
			config.workspaces.push(workspace);
			const saved = configManager.write(config);

			if (!saved) {
				return {
					success: false,
					error: "Failed to save workspace configuration",
				};
			}

			return {
				success: true,
				workspace,
			};
		} catch (error) {
			console.error("Failed to create workspace:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Update a workspace
	 */
	async update(
		input: UpdateWorkspaceInput,
	): Promise<{ success: boolean; workspace?: Workspace; error?: string }> {
		try {
			const config = configManager.read();
			const index = config.workspaces.findIndex((ws) => ws.id === input.id);

			if (index === -1) {
				return {
					success: false,
					error: "Workspace not found",
				};
			}

			// Update workspace
			const workspace = config.workspaces[index];
			if (input.name) workspace.name = input.name;
			if (input.layout) workspace.layout = input.layout;
			workspace.updatedAt = new Date().toISOString();

			config.workspaces[index] = workspace;
			const saved = configManager.write(config);

			if (!saved) {
				return {
					success: false,
					error: "Failed to save workspace configuration",
				};
			}

			return {
				success: true,
				workspace,
			};
		} catch (error) {
			console.error("Failed to update workspace:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Delete a workspace
	 */
	async delete(
		id: string,
		removeWorktree: boolean = false,
	): Promise<{ success: boolean; error?: string }> {
		try {
			const config = configManager.read();
			const workspace = config.workspaces.find((ws) => ws.id === id);

			if (!workspace) {
				return {
					success: false,
					error: "Workspace not found",
				};
			}

			// Optionally remove worktree
			if (removeWorktree) {
				const worktreePath = worktreeManager.getWorktreePath(
					workspace.repoPath,
					workspace.branch,
				);
				await worktreeManager.removeWorktree(workspace.repoPath, worktreePath);
			}

			// Remove from config
			config.workspaces = config.workspaces.filter((ws) => ws.id !== id);
			const saved = configManager.write(config);

			if (!saved) {
				return {
					success: false,
					error: "Failed to save workspace configuration",
				};
			}

			return { success: true };
		} catch (error) {
			console.error("Failed to delete workspace:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Get the worktree path for a workspace
	 */
	getWorktreePath(workspace: Workspace): string {
		return worktreeManager.getWorktreePath(
			workspace.repoPath,
			workspace.branch,
		);
	}
}

export default WorkspaceManager.getInstance();
