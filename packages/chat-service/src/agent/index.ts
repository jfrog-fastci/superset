export type { AgentManagerConfig } from "./agent-manager";
export { AgentManager } from "./agent-manager";
export {
	buildClaudeEnv,
	getCredentialsFromConfig,
	getCredentialsFromKeychain,
	getExistingClaudeCredentials,
	hasClaudeCredentials,
} from "./anthropic-auth";
export { getAvailableModels } from "./models";
export type { ResumeAgentOptions, RunAgentOptions } from "./run-agent";
export {
	parseTaskMentions,
	resumeAgent,
	runAgent,
	sessionAbortControllers,
	sessionContext,
	sessionRunIds,
} from "./run-agent";
export { StreamWatcher } from "./stream-watcher";
