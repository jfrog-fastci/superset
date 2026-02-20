import type { ModelOption } from "./types";

/** Default model used when no selection has been made */
export const DEFAULT_MODEL: ModelOption = {
	id: "anthropic/claude-opus-4-6",
	name: "Opus 4.6",
	provider: "Anthropic",
};

/** Hardcoded fallback shown while the API models load */
export const DEFAULT_AVAILABLE_MODELS: ModelOption[] = [
	{
		id: "anthropic/claude-opus-4-6",
		name: "Opus 4.6",
		provider: "Anthropic",
	},
	{
		id: "anthropic/claude-sonnet-4-6",
		name: "Sonnet 4.6",
		provider: "Anthropic",
	},
	{
		id: "anthropic/claude-haiku-4-5",
		name: "Haiku 4.5",
		provider: "Anthropic",
	},
	{
		id: "openai/gpt-5.3-codex-spark",
		name: "GPT-5.3-Codex-Spark",
		provider: "OpenAI",
	},
	{
		id: "openai/gpt-5.3-codex",
		name: "GPT-5.3-Codex",
		provider: "OpenAI",
	},
	{
		id: "openai/gpt-5.2-codex",
		name: "GPT-5.2-Codex",
		provider: "OpenAI",
	},
];

export const SUGGESTIONS = [
	"Explain this codebase",
	"Fix the failing tests",
	"Write tests for auth",
	"Refactor to async/await",
];

export const READ_ONLY_TOOLS = new Set([
	"mastra_workspace_read_file",
	"mastra_workspace_list_files",
	"mastra_workspace_file_stat",
	"mastra_workspace_search",
	"mastra_workspace_index",
]);
