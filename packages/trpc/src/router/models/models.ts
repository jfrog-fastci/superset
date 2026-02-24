import { db } from "@superset/db/client";
import {
	aiModelConfigEntrySchema,
	aiModelConfigSchema,
	appConfig,
} from "@superset/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure, protectedProcedure } from "../../trpc";

async function readModelsConfig() {
	const row = await db.query.appConfig.findFirst({
		where: eq(appConfig.key, "ai_models"),
	});
	return aiModelConfigSchema.parse(row?.value ?? []);
}

export const modelsRouter = {
	getModels: protectedProcedure.query(async () => {
		const config = await readModelsConfig();
		return {
			models: config
				.filter((m) => m.isEnabled)
				.map((m) => ({
					id: m.modelId,
					name: m.displayName,
					provider: m.provider,
				})),
		};
	}),

	list: adminProcedure.query(async () => {
		return readModelsConfig();
	}),

	create: adminProcedure
		.input(aiModelConfigEntrySchema)
		.mutation(async ({ input }) => {
			const config = await readModelsConfig();
			config.push(input);
			await db
				.insert(appConfig)
				.values({ key: "ai_models", value: config })
				.onConflictDoUpdate({ target: appConfig.key, set: { value: config } });
			return input;
		}),

	update: adminProcedure
		.input(
			z.object({
				modelId: z.string(),
				displayName: z.string().min(1).optional(),
				provider: z.string().min(1).optional(),
				isEnabled: z.boolean().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const config = await readModelsConfig();
			const entry = config.find((m) => m.modelId === input.modelId);
			if (!entry) throw new Error(`Model not found: ${input.modelId}`);
			if (input.displayName !== undefined)
				entry.displayName = input.displayName;
			if (input.provider !== undefined) entry.provider = input.provider;
			if (input.isEnabled !== undefined) entry.isEnabled = input.isEnabled;
			await db
				.update(appConfig)
				.set({ value: config })
				.where(eq(appConfig.key, "ai_models"));
			return entry;
		}),
} satisfies TRPCRouterRecord;
