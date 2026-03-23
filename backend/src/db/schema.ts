import { jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const bookmarks = pgTable("bookmarks", {
  id: varchar("id", { length: 36 }).primaryKey().notNull(), // UUID or random str
  inputUrl: text("input_url"),
  inputText: text("input_text"),
  analysisResult: jsonb("analysis_result").notNull(),
  source: varchar("source", { length: 32 }).default("web").notNull(),
  type: varchar("type", { length: 32 }).default("text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
