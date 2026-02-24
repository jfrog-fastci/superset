CREATE TABLE "app_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

INSERT INTO "app_config" ("key", "value") VALUES (
	'ai_models',
	'[
		{"modelId":"anthropic/claude-opus-4-6","displayName":"Opus 4.6","provider":"Anthropic","isEnabled":true},
		{"modelId":"anthropic/claude-sonnet-4-6","displayName":"Sonnet 4.6","provider":"Anthropic","isEnabled":true},
		{"modelId":"anthropic/claude-haiku-4-5","displayName":"Haiku 4.5","provider":"Anthropic","isEnabled":true}
	]'::jsonb
);
