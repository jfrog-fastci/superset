export interface Env {
	AUTH_URL: string;
	/** Local Docker Electric URL (e.g. http://localhost:3149/v1/shape) */
	ELECTRIC_URL?: string;
	/** Local Electric secret */
	ELECTRIC_SECRET?: string;
	/** Electric Cloud API URL (e.g. https://api.electric-sql.cloud) */
	ELECTRIC_CLOUD_URL?: string;
	/** Electric Cloud source ID */
	ELECTRIC_SOURCE_ID?: string;
	/** Electric Cloud source secret */
	ELECTRIC_SOURCE_SECRET?: string;
}

export interface AuthContext {
	sub: string;
	email: string;
	organizationIds: string[];
}

export interface WhereClause {
	fragment: string;
	params: unknown[];
}
