import type { Workspace } from "shared/types";

interface TabBarProps {
	workspaces: Workspace[];
	currentWorkspaceId: string | null;
	onSelectWorkspace: (id: string) => void;
	onCloseWorkspace: (id: string) => void;
	onNewWorkspace: () => void;
}

export default function TabBar({
	workspaces,
	currentWorkspaceId,
	onSelectWorkspace,
	onCloseWorkspace,
	onNewWorkspace,
}: TabBarProps) {
	return (
		<div className="flex items-center bg-gray-900 border-b border-gray-700 h-10 overflow-x-auto">
			{workspaces.map((workspace) => {
				const isActive = workspace.id === currentWorkspaceId;

				return (
					<div
						key={workspace.id}
						className={`
							flex items-center px-4 h-full cursor-pointer border-r border-gray-700 group
							${isActive ? "bg-gray-800 text-white" : "bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white"}
						`}
						onClick={() => onSelectWorkspace(workspace.id)}
					>
						<span className="text-sm mr-2">{workspace.name}</span>
						<button
							type="button"
							className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white transition-opacity"
							onClick={(e) => {
								e.stopPropagation();
								onCloseWorkspace(workspace.id);
							}}
						>
							<svg
								className="w-4 h-4"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					</div>
				);
			})}

			<button
				type="button"
				className="flex items-center justify-center px-4 h-full text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
				onClick={onNewWorkspace}
			>
				<svg
					className="w-5 h-5"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M12 4v16m8-8H4"
					/>
				</svg>
			</button>
		</div>
	);
}
