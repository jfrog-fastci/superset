import { workspaces } from "@superset/local-db";
import { observable } from "@trpc/server/observable";
import { localDb } from "main/lib/local-db";
import { loadStaticPorts } from "main/lib/static-ports";
import { portManager } from "main/lib/terminal/port-manager";
import type { DetectedPort, EnrichedPort } from "shared/types";
import { z } from "zod";
import { publicProcedure, router } from "../..";
import { getWorkspacePath } from "../workspaces/utils/worktree";

type PortEvent =
	| { type: "add"; port: DetectedPort }
	| { type: "remove"; port: DetectedPort };

/**
 * Build a lookup of port number → label from all workspaces' ports.json files.
 * Keyed by `${workspaceId}:${port}` to avoid collisions across workspaces.
 */
function buildStaticLabelMap(): Map<string, string> {
	const labelMap = new Map<string, string>();
	const allWorkspaces = localDb.select().from(workspaces).all();

	for (const workspace of allWorkspaces) {
		const workspacePath = getWorkspacePath(workspace);
		if (!workspacePath) continue;

		const result = loadStaticPorts(workspacePath);
		if (!result.exists || result.error || !result.ports) continue;

		for (const p of result.ports) {
			labelMap.set(`${workspace.id}:${p.port}`, p.label);
		}
	}

	return labelMap;
}

export const createPortsRouter = () => {
	return router({
		getAll: publicProcedure.query((): EnrichedPort[] => {
			const detectedPorts = portManager.getAllPorts();
			const labelMap = buildStaticLabelMap();

			return detectedPorts.map((port) => ({
				...port,
				label: labelMap.get(`${port.workspaceId}:${port.port}`) ?? null,
			}));
		}),

		subscribe: publicProcedure.subscription(() => {
			return observable<PortEvent>((emit) => {
				const onAdd = (port: DetectedPort) => {
					emit.next({ type: "add", port });
				};

				const onRemove = (port: DetectedPort) => {
					emit.next({ type: "remove", port });
				};

				portManager.on("port:add", onAdd);
				portManager.on("port:remove", onRemove);

				return () => {
					portManager.off("port:add", onAdd);
					portManager.off("port:remove", onRemove);
				};
			});
		}),

		kill: publicProcedure
			.input(
				z.object({
					paneId: z.string(),
					port: z.number().int().positive(),
				}),
			)
			.mutation(
				async ({ input }): Promise<{ success: boolean; error?: string }> => {
					return portManager.killPort(input);
				},
			),
	});
};
