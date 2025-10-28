import type { BrowserWindow, IpcMainInvokeEvent } from "electron";

import type { registerRoute } from "lib/electron-router-dom";

export type BrowserWindowOrNull = Electron.BrowserWindow | null;

type Route = Parameters<typeof registerRoute>[0];

export interface WindowProps extends Electron.BrowserWindowConstructorOptions {
	id: Route["id"];
	query?: Route["query"];
}

export interface WindowCreationByIPC {
	channel: string;
	window(): BrowserWindowOrNull;
	callback(window: BrowserWindow, event: IpcMainInvokeEvent): void;
}

// Workspace types
export interface TerminalPane {
	type: "pane";
	command?: string | null;
}

export interface TerminalSplit {
	type: "split";
	direction: "horizontal" | "vertical";
	ratio: number[]; // e.g., [1, 1, 1] for equal splits
	children: (TerminalPane | TerminalSplit)[];
}

export type LayoutNode = TerminalPane | TerminalSplit;

export interface Screen {
	id: string;
	name: string;
	layout: LayoutNode;
	createdAt: string;
}

export interface Worktree {
	id: string;
	branch: string;
	path: string;
	screens: Screen[];
	createdAt: string;
}

export interface Workspace {
	id: string;
	name: string;
	repoPath: string;
	branch: string;
	worktrees: Worktree[];
	createdAt: string;
	updatedAt: string;
}

export interface WorkspaceConfig {
	workspaces: Workspace[];
	lastOpenedWorkspaceId: string | null;
}

export interface CreateWorkspaceInput {
	name: string;
	repoPath: string;
	branch: string;
}

export interface CreateWorktreeInput {
	workspaceId: string;
	branch: string;
	createBranch?: boolean;
}

export interface CreateScreenInput {
	workspaceId: string;
	worktreeId: string;
	name: string;
	layout: LayoutNode;
}

export interface UpdateWorkspaceInput {
	id: string;
	name?: string;
}
