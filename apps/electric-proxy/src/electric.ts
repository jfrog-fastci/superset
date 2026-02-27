import type { AuthContext, Env, WhereClause } from "./types";

/**
 * Electric protocol query params that should be forwarded from the client request
 * to the upstream Electric Cloud service.
 * Source: @electric-sql/client/src/constants.ts
 */
const PROTOCOL_PARAMS = new Set([
	"live",
	"live_sse",
	"handle",
	"offset",
	"cursor",
	"expired_handle",
	"log",
	"subset__where",
	"subset__limit",
	"subset__offset",
	"subset__order_by",
	"subset__params",
	"subset__where_expr",
	"subset__order_by_expr",
	"cache-buster",
]);

/** Column allowlists for sensitive tables */
const COLUMN_RESTRICTIONS: Record<string, string> = {
	"auth.apikeys": "id,name,start,created_at,last_request",
	integration_connections:
		"id,organization_id,connected_by_user_id,provider,token_expires_at,external_org_id,external_org_name,config,created_at,updated_at",
};

export function buildUpstreamUrl(
	clientUrl: URL,
	tableName: string,
	whereClause: WhereClause,
	env: Env,
): URL {
	const useCloud = env.ELECTRIC_SOURCE_ID && env.ELECTRIC_SOURCE_SECRET;

	const upstream = useCloud
		? new URL("/v1/shape", env.ELECTRIC_CLOUD_URL)
		: new URL(env.ELECTRIC_URL ?? "http://localhost:3149/v1/shape");

	if (useCloud) {
		// biome-ignore lint/style/noNonNullAssertion: guarded by useCloud check
		upstream.searchParams.set("source_id", env.ELECTRIC_SOURCE_ID!);
		// biome-ignore lint/style/noNonNullAssertion: guarded by useCloud check
		upstream.searchParams.set("secret", env.ELECTRIC_SOURCE_SECRET!);
	} else if (env.ELECTRIC_SECRET) {
		upstream.searchParams.set("secret", env.ELECTRIC_SECRET);
	}

	// Forward Electric protocol params from the client request
	for (const [key, value] of clientUrl.searchParams) {
		if (PROTOCOL_PARAMS.has(key)) {
			upstream.searchParams.set(key, value);
		}
	}

	upstream.searchParams.set("table", tableName);
	upstream.searchParams.set("where", whereClause.fragment);
	for (let i = 0; i < whereClause.params.length; i++) {
		upstream.searchParams.set(
			`params[${i + 1}]`,
			String(whereClause.params[i]),
		);
	}

	const columns = COLUMN_RESTRICTIONS[tableName];
	if (columns) {
		upstream.searchParams.set("columns", columns);
	}

	return upstream;
}

/**
 * Build a cache key URL scoped to the auth context. For most tables, the where
 * clause already contains the organizationId so the cache key is naturally
 * org-scoped. For `auth.organizations`, the where clause contains user-specific
 * org IDs — less cache sharing but no cross-user leakage.
 */
export function buildCacheKey(upstreamUrl: URL, _auth: AuthContext): string {
	return upstreamUrl.toString();
}
