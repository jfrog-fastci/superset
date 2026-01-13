import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { env } from "@/env";

const SYSTEM_PROMPT = `You are the Superset Orchestration Agent, an AI assistant integrated into a developer productivity desktop app.

Your capabilities include:
- Helping users understand and manage their development tasks
- Answering questions about code and workflows
- Providing guidance on git operations and branch management

Guidelines:
- Be concise and direct
- Use markdown formatting for code and structured content
- When showing code, use appropriate syntax highlighting
- Focus on being helpful without unnecessary preamble`;

export async function POST(request: Request) {
	try {
		const { messages } = await request.json();

		if (!messages || !Array.isArray(messages)) {
			return new Response(
				JSON.stringify({ error: "Invalid messages format" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

		const result = streamText({
			model: anthropic("claude-sonnet-4-20250514"),
			system: SYSTEM_PROMPT,
			messages: messages.map((m: { role: string; content: string }) => ({
				role: m.role as "user" | "assistant",
				content: m.content,
			})),
		});

		return result.toTextStreamResponse();
	} catch (error) {
		console.error("[chat] Error:", error);
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}
