export interface SlashCommand {
	name: string;
	description: string;
	argumentHint: string;
}

export async function getSlashCommands(
	_workspaceId: string,
): Promise<SlashCommand[]> {
	// Placeholder — workspace-specific slash commands will be discovered here.
	return [];
}
