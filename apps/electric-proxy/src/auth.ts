import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AuthContext, Env } from "./types";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS(authUrl: string): ReturnType<typeof createRemoteJWKSet> {
	if (!jwks) {
		jwks = createRemoteJWKSet(new URL("/api/auth/jwks", authUrl));
	}
	return jwks;
}

export async function verifyJWT(
	token: string,
	env: Env,
): Promise<AuthContext | null> {
	try {
		const { payload } = await jwtVerify(token, getJWKS(env.AUTH_URL), {
			issuer: env.AUTH_URL,
			audience: env.AUTH_URL,
		});

		const sub = payload.sub;
		const email = payload.email as string | undefined;
		const organizationIds = payload.organizationIds as string[] | undefined;

		if (!sub || !organizationIds) {
			return null;
		}

		return { sub, email: email ?? "", organizationIds };
	} catch {
		return null;
	}
}
