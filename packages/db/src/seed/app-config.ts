import { db } from "../client";
import type { AiModelConfig } from "../schema";
import { appConfig } from "../schema";

const AI_MODELS: AiModelConfig = [
	{
		modelId: "anthropic/claude-opus-4-6",
		displayName: "Opus 4.6",
		provider: "Anthropic",
		isEnabled: true,
	},
	{
		modelId: "anthropic/claude-sonnet-4-6",
		displayName: "Sonnet 4.6",
		provider: "Anthropic",
		isEnabled: true,
	},
	{
		modelId: "anthropic/claude-haiku-4-5",
		displayName: "Haiku 4.5",
		provider: "Anthropic",
		isEnabled: true,
	},
];

async function seed() {
	await db
		.insert(appConfig)
		.values({ key: "ai_models", value: AI_MODELS })
		.onConflictDoUpdate({ target: appConfig.key, set: { value: AI_MODELS } });
	console.log("Seeded app_config: ai_models");
}

seed()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("Seed failed:", err);
		process.exit(1);
	});
