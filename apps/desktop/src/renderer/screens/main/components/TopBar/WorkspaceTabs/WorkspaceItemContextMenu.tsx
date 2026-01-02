import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@superset/ui/context-menu";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@superset/ui/hover-card";
import type { ReactNode } from "react";
import { LuEye, LuEyeOff } from "react-icons/lu";
import { trpc } from "renderer/lib/trpc";
import { WorkspaceHoverCardContent } from "./WorkspaceHoverCard";

interface WorkspaceItemContextMenuProps {
	children: ReactNode;
	workspaceId: string;
	worktreePath: string;
	workspaceAlias?: string;
	isUnread?: boolean;
	onRename: () => void;
	canRename?: boolean;
	showHoverCard?: boolean;
}

export function WorkspaceItemContextMenu({
	children,
	workspaceId,
	worktreePath,
	workspaceAlias,
	isUnread = false,
	onRename,
	canRename = true,
	showHoverCard = true,
}: WorkspaceItemContextMenuProps) {
	const utils = trpc.useUtils();
	const openInFinder = trpc.external.openInFinder.useMutation();
	const setUnread = trpc.workspaces.setUnread.useMutation({
		onSuccess: () => {
			utils.workspaces.getAllGrouped.invalidate();
		},
	});

	const handleOpenInFinder = () => {
		if (worktreePath) {
			openInFinder.mutate(worktreePath);
		}
	};

	const handleToggleUnread = () => {
		setUnread.mutate({ id: workspaceId, isUnread: !isUnread });
	};

	const unreadMenuItem = (
		<ContextMenuItem onSelect={handleToggleUnread}>
			{isUnread ? (
				<>
					<LuEye className="size-4 mr-2" />
					Mark as Read
				</>
			) : (
				<>
					<LuEyeOff className="size-4 mr-2" />
					Mark as Unread
				</>
			)}
		</ContextMenuItem>
	);

	// For branch workspaces, just show context menu without hover card
	if (!showHoverCard) {
		return (
			<ContextMenu>
				<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
				<ContextMenuContent>
					{canRename && (
						<>
							<ContextMenuItem onSelect={onRename}>Rename</ContextMenuItem>
							<ContextMenuSeparator />
						</>
					)}
					<ContextMenuItem onSelect={handleOpenInFinder}>
						Open in Finder
					</ContextMenuItem>
					<ContextMenuSeparator />
					{unreadMenuItem}
				</ContextMenuContent>
			</ContextMenu>
		);
	}

	return (
		<HoverCard openDelay={400} closeDelay={100}>
			<ContextMenu>
				<HoverCardTrigger asChild>
					<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
				</HoverCardTrigger>
				<ContextMenuContent>
					{canRename && (
						<>
							<ContextMenuItem onSelect={onRename}>Rename</ContextMenuItem>
							<ContextMenuSeparator />
						</>
					)}
					<ContextMenuItem onSelect={handleOpenInFinder}>
						Open in Finder
					</ContextMenuItem>
					<ContextMenuSeparator />
					{unreadMenuItem}
				</ContextMenuContent>
			</ContextMenu>
			<HoverCardContent side="bottom" align="start" className="w-72">
				<WorkspaceHoverCardContent
					workspaceId={workspaceId}
					workspaceAlias={workspaceAlias}
				/>
			</HoverCardContent>
		</HoverCard>
	);
}
