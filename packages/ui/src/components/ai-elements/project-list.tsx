"use client";

import { FolderIcon, GitBranchIcon } from "lucide-react";
import type { ComponentProps, HTMLAttributes } from "react";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";

export type Project = {
	id: string;
	name: string;
	workspaceCount?: number;
};

export type ProjectListProps = HTMLAttributes<HTMLDivElement> & {
	projects: Project[];
	onProjectClick?: (project: Project) => void;
};

export const ProjectList = ({
	className,
	projects,
	onProjectClick,
	...props
}: ProjectListProps) => (
	<div
		className={cn("flex flex-col gap-2 rounded-lg border p-3", className)}
		{...props}
	>
		<div className="flex items-center gap-2 text-muted-foreground">
			<FolderIcon className="size-4" />
			<span className="font-medium text-xs uppercase tracking-wide">
				Projects ({projects.length})
			</span>
		</div>
		<div className="flex flex-col gap-1">
			{projects.map((project) => (
				<ProjectListItem
					key={project.id}
					project={project}
					onClick={onProjectClick ? () => onProjectClick(project) : undefined}
				/>
			))}
		</div>
	</div>
);

export type ProjectListItemProps = ComponentProps<"button"> & {
	project: Project;
};

export const ProjectListItem = ({
	className,
	project,
	onClick,
	...props
}: ProjectListItemProps) => (
	<button
		type="button"
		className={cn(
			"flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
			onClick ? "cursor-pointer hover:bg-muted/50" : "cursor-default",
			className,
		)}
		onClick={onClick}
		disabled={!onClick}
		{...props}
	>
		<div className="flex items-center gap-2 min-w-0">
			<FolderIcon className="size-4 text-muted-foreground shrink-0" />
			<span className="font-medium text-sm truncate">{project.name}</span>
		</div>
		{project.workspaceCount !== undefined && (
			<Badge variant="secondary" className="text-[10px] shrink-0">
				{project.workspaceCount} workspace
				{project.workspaceCount !== 1 ? "s" : ""}
			</Badge>
		)}
	</button>
);

export type ProjectCardProps = HTMLAttributes<HTMLDivElement> & {
	project: Project;
	children?: React.ReactNode;
};

export const ProjectCard = ({
	className,
	project,
	children,
	...props
}: ProjectCardProps) => (
	<div
		className={cn("rounded-lg border bg-card p-3 space-y-2", className)}
		{...props}
	>
		<div className="flex items-center gap-2">
			<FolderIcon className="size-4 text-primary" />
			<span className="font-medium text-sm">{project.name}</span>
		</div>
		{children}
	</div>
);
