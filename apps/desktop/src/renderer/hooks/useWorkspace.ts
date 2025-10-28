import { useCallback, useEffect, useState } from "react";
import type {
	CreateWorkspaceInput,
	UpdateWorkspaceInput,
	Workspace,
} from "shared/types";

declare global {
	interface Window {
		ipcRenderer: {
			invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>;
		};
	}
}

export function useWorkspace() {
	const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
	const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(
		null,
	);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const currentWorkspace = workspaces.find(
		(ws) => ws.id === currentWorkspaceId,
	);

	// Load workspaces on mount
	const loadWorkspaces = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const result =
				await window.ipcRenderer.invoke<Workspace[]>("workspace-list");
			setWorkspaces(result);

			// Set current workspace to first one if none selected
			if (!currentWorkspaceId && result.length > 0) {
				setCurrentWorkspaceId(result[0].id);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [currentWorkspaceId]);

	useEffect(() => {
		loadWorkspaces();
	}, []);

	const createWorkspace = useCallback(
		async (input: CreateWorkspaceInput) => {
			try {
				setError(null);
				const result = await window.ipcRenderer.invoke<{
					success: boolean;
					workspace?: Workspace;
					error?: string;
				}>("workspace-create", input);

				if (!result.success) {
					throw new Error(result.error || "Failed to create workspace");
				}

				// Reload workspaces
				await loadWorkspaces();

				// Set as current workspace
				if (result.workspace) {
					setCurrentWorkspaceId(result.workspace.id);
				}

				return result.workspace;
			} catch (err) {
				const errorMsg = err instanceof Error ? err.message : String(err);
				setError(errorMsg);
				throw new Error(errorMsg);
			}
		},
		[loadWorkspaces],
	);

	const updateWorkspace = useCallback(
		async (input: UpdateWorkspaceInput) => {
			try {
				setError(null);
				const result = await window.ipcRenderer.invoke<{
					success: boolean;
					workspace?: Workspace;
					error?: string;
				}>("workspace-update", input);

				if (!result.success) {
					throw new Error(result.error || "Failed to update workspace");
				}

				// Reload workspaces
				await loadWorkspaces();

				return result.workspace;
			} catch (err) {
				const errorMsg = err instanceof Error ? err.message : String(err);
				setError(errorMsg);
				throw new Error(errorMsg);
			}
		},
		[loadWorkspaces],
	);

	const deleteWorkspace = useCallback(
		async (id: string, removeWorktree = false) => {
			try {
				setError(null);
				const result = await window.ipcRenderer.invoke<{
					success: boolean;
					error?: string;
				}>("workspace-delete", id, removeWorktree);

				if (!result.success) {
					throw new Error(result.error || "Failed to delete workspace");
				}

				// If deleting current workspace, switch to another
				if (id === currentWorkspaceId) {
					const remaining = workspaces.filter((ws) => ws.id !== id);
					setCurrentWorkspaceId(remaining.length > 0 ? remaining[0].id : null);
				}

				// Reload workspaces
				await loadWorkspaces();
			} catch (err) {
				const errorMsg = err instanceof Error ? err.message : String(err);
				setError(errorMsg);
				throw new Error(errorMsg);
			}
		},
		[currentWorkspaceId, workspaces, loadWorkspaces],
	);

	const getWorktreePath = useCallback(async (workspaceId: string) => {
		try {
			const path = await window.ipcRenderer.invoke<string | null>(
				"workspace-get-worktree-path",
				workspaceId,
			);
			return path;
		} catch (err) {
			console.error("Failed to get worktree path:", err);
			return null;
		}
	}, []);

	const switchWorkspace = useCallback((id: string) => {
		setCurrentWorkspaceId(id);
	}, []);

	return {
		workspaces,
		currentWorkspace,
		currentWorkspaceId,
		loading,
		error,
		createWorkspace,
		updateWorkspace,
		deleteWorkspace,
		switchWorkspace,
		getWorktreePath,
		reload: loadWorkspaces,
	};
}
