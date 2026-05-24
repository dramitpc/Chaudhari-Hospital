import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const drugsTable = pgTable("drugs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  genericName: text("generic_name"),
  category: text("category"),
  form: text("form"),
  strength: text("strength"),
  manufacturer: text("manufacturer"),
  defaultDosage: text("default_dosage"),
  defaultFrequency: text("default_frequency"),
  defaultDuration: text("default_duration"),
  defaultInstructions: text("default_instructions"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDrugSchema = createInsertSchema(drugsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDrug = z.infer<typeof insertDrugSchema>;
export type Drug = typeof drugsTable.$inferSelect;
