import { homedir } from "node:os";
import { join } from "node:path";
import type { SelectProject } from "@superset/local-db";
import { SUPERSET_DIR_NAME, WORKTREES_DIR_NAME } from "shared/constants";

export function resolveWorktreePath(
	project: Pick<SelectProject, "name">,
	branch: string,
): string {
	const baseDir = join(homedir(), SUPERSET_DIR_NAME, WORKTREES_DIR_NAME);
	return join(baseDir, project.name, branch);
}
