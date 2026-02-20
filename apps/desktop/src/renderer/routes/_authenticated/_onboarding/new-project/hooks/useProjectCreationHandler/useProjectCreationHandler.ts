import { electronTrpc } from "renderer/lib/electron-trpc";
import { useCreateWorkspace } from "renderer/react-query/workspaces";

export function useProjectCreationHandler(
	onError: (error: string) => void,
	options?: { parentDir?: string },
) {
	const utils = electronTrpc.useUtils();
	const createWorkspace = useCreateWorkspace();
	const setDefaultProjectPath =
		electronTrpc.settings.setDefaultProjectPath.useMutation();

	const handleResult = (
		result: {
			canceled?: boolean;
			success?: boolean;
			error?: string | null;
			project?: { id: string } | null;
		},
		resetState?: () => void,
	) => {
		if (result.canceled) return;
		if (result.success && result.project) {
			utils.projects.getRecents.invalidate();
			createWorkspace.mutate({ projectId: result.project.id });
			if (options?.parentDir) {
				setDefaultProjectPath.mutate({ path: options.parentDir });
			}
			resetState?.();
		} else if (!result.success && result.error) {
			onError(result.error);
		}
	};

	const handleError = (err: { message?: string }) => {
		onError(err.message || "Operation failed");
	};

	return {
		handleResult,
		handleError,
		isCreatingWorkspace: createWorkspace.isPending,
	};
}
