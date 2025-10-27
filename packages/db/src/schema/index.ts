import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const workspace = pgTable("workspace", {
	id: integer("id").primaryKey(),
	rootDir: text("root_dir").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
