import { defineConfig } from "drizzle-kit";

const DEFAULT_DATABASE_URL =
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export default defineConfig({
    schema: "./src/schema",
    out: "./migrations",
    dialect: "postgresql",
    schemaFilter: ["public"],
    verbose: true,
    dbCredentials: {
        url: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
    },
});
