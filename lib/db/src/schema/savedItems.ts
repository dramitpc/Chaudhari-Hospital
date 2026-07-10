import { pgTable, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const userSavedItemsTable = pgTable("user_saved_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  namespace: text("namespace").notNull(),
  kind: text("kind", { enum: ["favorite", "recent"] }).notNull(),
  name: text("name").notNull().default(""),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("user_saved_items_user_namespace_kind_idx").on(table.userId, table.namespace, table.kind),
]);

export const insertUserSavedItemSchema = createInsertSchema(userSavedItemsTable).omit({ id: true, userId: true, createdAt: true });
export type InsertUserSavedItem = z.infer<typeof insertUserSavedItemSchema>;
export type UserSavedItem = typeof userSavedItemsTable.$inferSelect;
