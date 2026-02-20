import Anthropic from "@anthropic-ai/sdk";
import { db } from "@superset/db/client";
import { chatSessions } from "@superset/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { env } from "../../env";
import { protectedProcedure } from "../../trpc";

const AVAILABLE_MODELS = [
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
];

export const chatRouter = {
	getModels: protectedProcedure.query(() => {
		return { models: AVAILABLE_MODELS };
	}),

	generateTitle: protectedProcedure
		.input(
			z.object({
				sessionId: z.string().uuid(),
				messages: z
					.array(z.object({ role: z.string(), text: z.string() }))
					.max(20),
			}),
		)
		.mutation(async ({ input }) => {
			const digest = input.messages
				.map((m) => `${m.role}: ${m.text}`)
				.join("\n");

			const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
			const response = await client.messages.create({
				model: "claude-haiku-4-5-20251001",
				max_tokens: 30,
				system:
					"Generate a concise 3-6 word title for this conversation. Return only the title, no quotes or punctuation.",
				messages: [{ role: "user", content: digest }],
			});

			const title =
				response.content[0]?.type === "text"
					? response.content[0].text.trim()
					: "Untitled Chat";

			await db
				.update(chatSessions)
				.set({ title })
				.where(eq(chatSessions.id, input.sessionId));

			return { title };
		}),
} satisfies TRPCRouterRecord;
