import { randomUUID } from "node:crypto";

import type {
	CreateScreenInput,
	CreateWorkspaceInput,
	CreateWorktreeInput,
	LayoutNode,
	Screen,
	UpdateWorkspaceInput,
	Workspace,
	Worktree,
} from "shared/types";

import configManager from "./config-manager";
import worktreeManager from "./worktree-manager";

// Default 4-pane layout
const DEFAULT_LAYOUT: LayoutNode = {
	type: "split",
	direction: "vertical",
	ratio: [1, 1, 1],
	children: [
		{ type: "pane", command: null },
		{ type: "pane", command: null },
		{
			type: "split",
			direction: "horizontal",
			ratio: [1, 1],
			children: [
				{ type: "pane", command: null },
				{ type: "pane", command: null },
			],
		},
	],
};

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
	 * Create a new workspace (container for worktrees)
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

			// Create workspace object - starts with no worktrees
			const now = new Date().toISOString();
			const workspace: Workspace = {
				id: randomUUID(),
				name: input.name,
				repoPath: input.repoPath,
				branch: input.branch,
				worktrees: [],
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

			// Set as last opened workspace
			configManager.setLastOpenedWorkspaceId(workspace.id);

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
	 * Create a new worktree with a default screen
	 */
	async createWorktree(
		input: CreateWorktreeInput,
	): Promise<{ success: boolean; worktree?: Worktree; error?: string }> {
		try {
			const workspace = await this.get(input.workspaceId);
			if (!workspace) {
				return { success: false, error: "Workspace not found" };
			}

			// Create git worktree
			const worktreeResult = await worktreeManager.createWorktree(
				workspace.repoPath,
				input.branch,
				input.createBranch || false,
			);

			if (!worktreeResult.success) {
				return {
					success: false,
					error: `Failed to create worktree: ${worktreeResult.error}`,
				};
			}

			// Create default screen
			const now = new Date().toISOString();
			const defaultScreen: Screen = {
				id: randomUUID(),
				name: "default",
				layout: DEFAULT_LAYOUT,
				createdAt: now,
			};

			// Create worktree object
			const worktree: Worktree = {
				id: randomUUID(),
				branch: input.branch,
				path: worktreeResult.path!,
				screens: [defaultScreen],
				createdAt: now,
			};

			// Add to workspace
			workspace.worktrees.push(worktree);
			workspace.updatedAt = now;

			// Save
			const config = configManager.read();
			const index = config.workspaces.findIndex((ws) => ws.id === workspace.id);
			if (index !== -1) {
				config.workspaces[index] = workspace;
				configManager.write(config);
			}

			return { success: true, worktree };
		} catch (error) {
			console.error("Failed to create worktree:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Create a new screen in a worktree
	 */
	async createScreen(
		input: CreateScreenInput,
	): Promise<{ success: boolean; screen?: Screen; error?: string }> {
		try {
			const workspace = await this.get(input.workspaceId);
			if (!workspace) {
				return { success: false, error: "Workspace not found" };
			}

			const worktree = workspace.worktrees.find(
				(wt) => wt.id === input.worktreeId,
			);
			if (!worktree) {
				return { success: false, error: "Worktree not found" };
			}

			const screen: Screen = {
				id: randomUUID(),
				name: input.name,
				layout: input.layout,
				createdAt: new Date().toISOString(),
			};

			worktree.screens.push(screen);
			workspace.updatedAt = new Date().toISOString();

			// Save
			const config = configManager.read();
			const index = config.workspaces.findIndex((ws) => ws.id === workspace.id);
			if (index !== -1) {
				config.workspaces[index] = workspace;
				configManager.write(config);
			}

			return { success: true, screen };
		} catch (error) {
			console.error("Failed to create screen:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Get the last opened workspace
	 */
	async getLastOpened(): Promise<Workspace | null> {
		const lastId = configManager.getLastOpenedWorkspaceId();
		if (!lastId) return null;
		return await this.get(lastId);
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
		removeWorktree = false,
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
	 * Get a screen by ID
	 */
	getScreen(
		workspaceId: string,
		worktreeId: string,
		screenId: string,
	): Screen | null {
		const config = configManager.read();
		const workspace = config.workspaces.find((ws) => ws.id === workspaceId);
		if (!workspace) return null;

		const worktree = workspace.worktrees.find((wt) => wt.id === worktreeId);
		if (!worktree) return null;

		return worktree.screens.find((s) => s.id === screenId) || null;
	}

	/**
	 * Scan and import existing git worktrees for a workspace
	 */
	async scanAndImportWorktrees(
		workspaceId: string,
	): Promise<{ success: boolean; imported?: number; error?: string }> {
		try {
			const workspace = await this.get(workspaceId);
			if (!workspace) {
				return { success: false, error: "Workspace not found" };
			}

			// Get all git worktrees from the repository
			const gitWorktrees = worktreeManager.listWorktrees(workspace.repoPath);

			// Include all worktrees (including main repo)
			const allWorktrees = gitWorktrees.filter((wt) => !wt.bare);

			let importedCount = 0;
			const now = new Date().toISOString();

			for (const gitWorktree of allWorktrees) {
				// Check if this worktree is already in our workspace
				const existingWorktree = workspace.worktrees.find(
					(wt) =>
						wt.path === gitWorktree.path || wt.branch === gitWorktree.branch,
				);

				if (!existingWorktree) {
					// Create default screen with stub terminal
					const defaultScreen: Screen = {
						id: randomUUID(),
						name: "default",
						layout: DEFAULT_LAYOUT,
						createdAt: now,
					};

					// Create worktree object
					const worktree: Worktree = {
						id: randomUUID(),
						branch: gitWorktree.branch,
						path: gitWorktree.path,
						screens: [defaultScreen],
						createdAt: now,
					};

					workspace.worktrees.push(worktree);
					importedCount++;
				}
			}

			if (importedCount > 0) {
				workspace.updatedAt = now;

				// Save to config
				const config = configManager.read();
				const index = config.workspaces.findIndex(
					(ws) => ws.id === workspace.id,
				);
				if (index !== -1) {
					config.workspaces[index] = workspace;
					configManager.write(config);
				}
			}

			return { success: true, imported: importedCount };
		} catch (error) {
			console.error("Failed to scan and import worktrees:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}
}

export default WorkspaceManager.getInstance();
