"use client";

import {
	CheckCircleIcon,
	FolderIcon,
	GitBranchIcon,
	GitForkIcon,
	LayoutGridIcon,
} from "lucide-react";
import type { ComponentProps, HTMLAttributes } from "react";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "../ui/collapsible";

export type Workspace = {
	id: string;
	name: string;
	branch: string;
	type: "worktree" | "branch";
	path?: string;
	isActive?: boolean;
};

export type WorkspaceGroup = {
	project: {
		id: string;
		name: string;
	};
	workspaces: Workspace[];
};

export type WorkspaceListProps = HTMLAttributes<HTMLDivElement> & {
	groups: WorkspaceGroup[];
	onWorkspaceClick?: (workspace: Workspace) => void;
};

export const WorkspaceList = ({
	className,
	groups,
	onWorkspaceClick,
	...props
}: WorkspaceListProps) => {
	const totalWorkspaces = groups.reduce(
		(sum, g) => sum + g.workspaces.length,
		0,
	);

	return (
		<div
			className={cn("flex flex-col gap-3 rounded-lg border p-3", className)}
			{...props}
		>
			<div className="flex items-center gap-2 text-muted-foreground">
				<LayoutGridIcon className="size-4" />
				<span className="font-medium text-xs uppercase tracking-wide">
					Workspaces ({totalWorkspaces})
				</span>
			</div>
			<div className="flex flex-col gap-2">
				{groups.map((group) => (
					<WorkspaceGroupCard
						key={group.project.id}
						group={group}
						onWorkspaceClick={onWorkspaceClick}
					/>
				))}
			</div>
		</div>
	);
};

export type WorkspaceGroupCardProps = ComponentProps<typeof Collapsible> & {
	group: WorkspaceGroup;
	onWorkspaceClick?: (workspace: Workspace) => void;
};

export const WorkspaceGroupCard = ({
	className,
	group,
	onWorkspaceClick,
	defaultOpen = true,
	...props
}: WorkspaceGroupCardProps) => (
	<Collapsible
		className={cn("rounded-md border bg-muted/30", className)}
		defaultOpen={defaultOpen}
		{...props}
	>
		<CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors">
			<FolderIcon className="size-4 text-primary shrink-0" />
			<span className="font-medium text-sm flex-1 text-left truncate">
				{group.project.name}
			</span>
			<Badge variant="secondary" className="text-[10px]">
				{group.workspaces.length}
			</Badge>
		</CollapsibleTrigger>
		<CollapsibleContent>
			<div className="flex flex-col gap-0.5 px-2 pb-2">
				{group.workspaces.map((workspace) => (
					<WorkspaceListItem
						key={workspace.id}
						workspace={workspace}
						onClick={
							onWorkspaceClick ? () => onWorkspaceClick(workspace) : undefined
						}
					/>
				))}
			</div>
		</CollapsibleContent>
	</Collapsible>
);

export type WorkspaceListItemProps = ComponentProps<"button"> & {
	workspace: Workspace;
};

export const WorkspaceListItem = ({
	className,
	workspace,
	onClick,
	...props
}: WorkspaceListItemProps) => (
	<button
		type="button"
		className={cn(
			"flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
			onClick ? "cursor-pointer hover:bg-background" : "cursor-default",
			workspace.isActive && "bg-primary/10 border border-primary/20",
			className,
		)}
		onClick={onClick}
		disabled={!onClick}
		{...props}
	>
		{workspace.type === "worktree" ? (
			<GitForkIcon className="size-3.5 text-muted-foreground shrink-0" />
		) : (
			<GitBranchIcon className="size-3.5 text-muted-foreground shrink-0" />
		)}
		<div className="flex flex-col min-w-0 flex-1">
			<span className="text-sm truncate">{workspace.name}</span>
			<span className="text-[10px] text-muted-foreground truncate">
				{workspace.branch}
			</span>
		</div>
		{workspace.isActive && (
			<CheckCircleIcon className="size-3.5 text-primary shrink-0" />
		)}
		<Badge variant="outline" className="text-[10px] shrink-0">
			{workspace.type}
		</Badge>
	</button>
);

export type ActiveWorkspaceCardProps = HTMLAttributes<HTMLDivElement> & {
	workspace: Workspace & {
		project?: { id: string; name: string } | null;
		worktreePath?: string;
	};
};

export const ActiveWorkspaceCard = ({
	className,
	workspace,
	...props
}: ActiveWorkspaceCardProps) => (
	<div
		className={cn(
			"rounded-lg border bg-primary/5 border-primary/20 p-3 space-y-2",
			className,
		)}
		{...props}
	>
		<div className="flex items-center gap-2">
			<CheckCircleIcon className="size-4 text-primary" />
			<span className="font-medium text-sm">Active Workspace</span>
		</div>
		<div className="space-y-1 text-sm">
			<div className="flex items-center gap-2">
				<span className="text-muted-foreground text-xs w-16">Name:</span>
				<span className="font-medium">{workspace.name}</span>
			</div>
			<div className="flex items-center gap-2">
				<span className="text-muted-foreground text-xs w-16">Branch:</span>
				<code className="text-xs bg-muted px-1.5 py-0.5 rounded">
					{workspace.branch}
				</code>
			</div>
			<div className="flex items-center gap-2">
				<span className="text-muted-foreground text-xs w-16">Type:</span>
				<Badge variant="outline" className="text-[10px]">
					{workspace.type}
				</Badge>
			</div>
			{workspace.project && (
				<div className="flex items-center gap-2">
					<span className="text-muted-foreground text-xs w-16">Project:</span>
					<span className="text-xs">{workspace.project.name}</span>
				</div>
			)}
			{workspace.worktreePath && (
				<div className="flex items-center gap-2">
					<span className="text-muted-foreground text-xs w-16">Path:</span>
					<code className="text-[10px] bg-muted px-1.5 py-0.5 rounded truncate max-w-[200px]">
						{workspace.worktreePath}
					</code>
				</div>
			)}
		</div>
	</div>
);
