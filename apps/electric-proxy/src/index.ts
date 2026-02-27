import { verifyJWT } from "./auth";
import { buildCacheKey, buildUpstreamUrl } from "./electric";
import type { Env } from "./types";
import { buildWhereClause } from "./where";

const CORS_HEADERS: Record<string, string> = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Authorization, Content-Type",
	"Access-Control-Expose-Headers":
		"electric-handle, electric-offset, electric-schema, electric-up-to-date, electric-cursor",
};

function corsResponse(status: number, body: string): Response {
	return new Response(body, { status, headers: CORS_HEADERS });
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		// CORS preflight
		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: CORS_HEADERS });
		}

		if (request.method !== "GET") {
			return corsResponse(405, "Method not allowed");
		}

		// Extract and verify JWT
		const authHeader = request.headers.get("Authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			return corsResponse(401, "Missing or invalid Authorization header");
		}

		const token = authHeader.slice(7);
		const auth = await verifyJWT(token, env);
		if (!auth) {
			return corsResponse(401, "Invalid or expired token");
		}

		const url = new URL(request.url);

		// Validate required params
		const tableName = url.searchParams.get("table");
		if (!tableName) {
			return corsResponse(400, "Missing table parameter");
		}

		const organizationId = url.searchParams.get("organizationId");

		// auth.organizations doesn't need organizationId — it uses the JWT's org list
		if (tableName !== "auth.organizations") {
			if (!organizationId) {
				return corsResponse(400, "Missing organizationId parameter");
			}
			if (!auth.organizationIds.includes(organizationId)) {
				return corsResponse(403, "Not a member of this organization");
			}
		}

		// Build where clause (pure function, no DB)
		const whereClause = buildWhereClause(
			tableName,
			organizationId ?? "",
			auth.organizationIds,
		);
		if (!whereClause) {
			return corsResponse(400, `Unknown table: ${tableName}`);
		}

		// Build upstream Electric Cloud URL
		const upstreamUrl = buildUpstreamUrl(url, tableName, whereClause, env);
		const cacheKey = buildCacheKey(upstreamUrl, auth);

		// Check Cloudflare Cache API
		const cache = caches.default;
		const cacheRequest = new Request(cacheKey);
		let response = await cache.match(cacheRequest);

		if (!response) {
			// Cache miss — fetch from upstream Electric
			response = await fetch(upstreamUrl.toString());

			// Strip content-encoding to avoid decompression issues
			const headers = new Headers(response.headers);
			if (headers.get("content-encoding")) {
				headers.delete("content-encoding");
				headers.delete("content-length");
			}

			response = new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers,
			});

			// Cache if Electric sent Cache-Control headers and the response is successful
			if (response.ok && response.headers.has("cache-control")) {
				// Use waitUntil-free put — Cloudflare handles it in the background
				await cache.put(cacheRequest, response.clone());
			}
		}

		// Add CORS headers to the response
		const finalHeaders = new Headers(response.headers);
		for (const [key, value] of Object.entries(CORS_HEADERS)) {
			finalHeaders.set(key, value);
		}

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: finalHeaders,
		});
	},
} satisfies ExportedHandler<Env>;
