import { createAuthStorage } from "mastracode";
import {
	createAnthropicOAuthSession,
	exchangeAnthropicAuthorizationCode,
	getCredentialsFromConfig,
	getCredentialsFromKeychain,
} from "../auth/anthropic";

type OpenAIAuthMethod = "api_key" | "env_api_key" | "oauth" | null;
type AnthropicAuthMethod = "api_key" | "env_api_key" | "oauth" | null;
type AuthStorageCredential =
	| { type: "api_key"; key: string }
	| { type: "oauth"; access: string; expires: number };
const OPENAI_AUTH_PROVIDER_ID = "openai-codex";
const ANTHROPIC_AUTH_PROVIDER_ID = "anthropic";
type OpenAIAuthStorage = ReturnType<typeof createAuthStorage>;

type AnthropicOAuthCredentials = {
	accessToken: string;
	refreshToken?: string;
	expiresAt?: number;
};

let anthropicOAuthCredentials: AnthropicOAuthCredentials | null = null;

function setAnthropicOAuthCredentials(
	credentials: AnthropicOAuthCredentials,
): void {
	anthropicOAuthCredentials = credentials;
}

function getAnthropicAuthToken(): string | null {
	if (!anthropicOAuthCredentials) return null;
	if (
		typeof anthropicOAuthCredentials.expiresAt === "number" &&
		Date.now() >= anthropicOAuthCredentials.expiresAt
	) {
		anthropicOAuthCredentials = null;
		return null;
	}

	return anthropicOAuthCredentials.accessToken;
}

export class ChatService {
	private anthropicAuthSession: {
		verifier: string;
		state: string;
		createdAt: number;
	} | null = null;
	private authStorage: OpenAIAuthStorage | null = null;
	private static readonly ANTHROPIC_AUTH_SESSION_TTL_MS = 10 * 60 * 1000;

	getAnthropicAuthStatus(): {
		authenticated: boolean;
		method: AnthropicAuthMethod;
	} {
		const method = this.resolveAnthropicAuthMethod();
		return { authenticated: method !== null, method };
	}

	async getOpenAIAuthStatus(): Promise<{
		authenticated: boolean;
		method: OpenAIAuthMethod;
	}> {
		const method = this.resolveOpenAIAuthMethod();
		return { authenticated: method !== null, method };
	}

	async setOpenAIApiKey(input: { apiKey: string }): Promise<{ success: true }> {
		const trimmedApiKey = input.apiKey.trim();
		if (trimmedApiKey.length === 0) {
			throw new Error("OpenAI API key is required");
		}

		const authStorage = this.getAuthStorage();
		authStorage.reload();
		authStorage.set(OPENAI_AUTH_PROVIDER_ID, {
			type: "api_key",
			key: trimmedApiKey,
		} satisfies AuthStorageCredential);

		process.env.OPENAI_API_KEY = trimmedApiKey;
		return { success: true };
	}

	async clearOpenAIApiKey(): Promise<{ success: true }> {
		const authStorage = this.getAuthStorage();
		authStorage.reload();
		const credential = authStorage.get(OPENAI_AUTH_PROVIDER_ID);
		if (credential?.type !== "api_key") {
			return { success: true };
		}

		authStorage.remove(OPENAI_AUTH_PROVIDER_ID);
		if (process.env.OPENAI_API_KEY?.trim() === credential.key.trim()) {
			delete process.env.OPENAI_API_KEY;
		}

		return { success: true };
	}

	async setAnthropicApiKey(input: {
		apiKey: string;
	}): Promise<{ success: true }> {
		const trimmedApiKey = input.apiKey.trim();
		if (trimmedApiKey.length === 0) {
			throw new Error("Anthropic API key is required");
		}

		const authStorage = this.getAuthStorage();
		authStorage.reload();
		authStorage.set(ANTHROPIC_AUTH_PROVIDER_ID, {
			type: "api_key",
			key: trimmedApiKey,
		} satisfies AuthStorageCredential);

		process.env.ANTHROPIC_API_KEY = trimmedApiKey;
		return { success: true };
	}

	async clearAnthropicApiKey(): Promise<{ success: true }> {
		const authStorage = this.getAuthStorage();
		authStorage.reload();
		const credential = authStorage.get(ANTHROPIC_AUTH_PROVIDER_ID);
		if (credential?.type !== "api_key") {
			return { success: true };
		}

		authStorage.remove(ANTHROPIC_AUTH_PROVIDER_ID);
		if (process.env.ANTHROPIC_API_KEY?.trim() === credential.key.trim()) {
			delete process.env.ANTHROPIC_API_KEY;
		}

		return { success: true };
	}

	private resolveOpenAIAuthMethod(): OpenAIAuthMethod {
		const authStorage = this.getAuthStorage();
		authStorage.reload();
		const credential = authStorage.get(OPENAI_AUTH_PROVIDER_ID);
		if (credential?.type === "oauth") {
			return "oauth";
		}
		if (credential?.type === "api_key" && credential.key.trim().length > 0) {
			process.env.OPENAI_API_KEY = credential.key.trim();
			return "api_key";
		}
		if (process.env.OPENAI_API_KEY?.trim()) {
			return "env_api_key";
		}
		return null;
	}

	private resolveAnthropicAuthMethod(): AnthropicAuthMethod {
		const oauthToken = getAnthropicAuthToken();
		if (oauthToken) {
			return "oauth";
		}

		const cliCredentials =
			getCredentialsFromConfig() ?? getCredentialsFromKeychain();
		if (cliCredentials?.kind === "oauth") {
			setAnthropicOAuthCredentials({
				accessToken: cliCredentials.apiKey,
			});
			return "oauth";
		}

		const authStorage = this.getAuthStorage();
		authStorage.reload();
		const credential = authStorage.get(ANTHROPIC_AUTH_PROVIDER_ID);
		if (credential?.type === "api_key" && credential.key.trim().length > 0) {
			process.env.ANTHROPIC_API_KEY = credential.key.trim();
			return "api_key";
		}

		if (process.env.ANTHROPIC_API_KEY?.trim()) {
			return "env_api_key";
		}

		if (cliCredentials?.kind === "apiKey" && cliCredentials.apiKey.trim()) {
			process.env.ANTHROPIC_API_KEY = cliCredentials.apiKey.trim();
			return "env_api_key";
		}

		return null;
	}

	private getAuthStorage(): OpenAIAuthStorage {
		if (!this.authStorage) {
			// Standalone auth storage bootstrap.
			// This path intentionally avoids full createMastraCode runtime initialization.
			this.authStorage = createAuthStorage();
		}
		return this.authStorage;
	}

	startAnthropicOAuth(): { url: string; instructions: string } {
		const session = createAnthropicOAuthSession();
		this.anthropicAuthSession = {
			verifier: session.verifier,
			state: session.state,
			createdAt: session.createdAt,
		};

		return {
			url: session.authUrl,
			instructions:
				"Authorize Anthropic in your browser, then paste the code shown there (format: code#state).",
		};
	}

	cancelAnthropicOAuth(): { success: true } {
		this.anthropicAuthSession = null;
		return { success: true };
	}

	async completeAnthropicOAuth(input: {
		code: string;
	}): Promise<{ success: true; expiresAt: number }> {
		if (!this.anthropicAuthSession) {
			throw new Error("No active Anthropic auth session. Start auth again.");
		}

		const elapsed = Date.now() - this.anthropicAuthSession.createdAt;
		if (elapsed > ChatService.ANTHROPIC_AUTH_SESSION_TTL_MS) {
			this.anthropicAuthSession = null;
			throw new Error(
				"Anthropic auth session expired. Start auth again and paste a fresh code.",
			);
		}

		const session = this.anthropicAuthSession;
		this.anthropicAuthSession = null;

		const credentials = await exchangeAnthropicAuthorizationCode({
			rawCode: input.code,
			verifier: session.verifier,
			expectedState: session.state,
		});

		setAnthropicOAuthCredentials(credentials);
		return { success: true, expiresAt: credentials.expiresAt };
	}
}
