import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { patientsTable } from "./patients";
import { consultationsTable } from "./consultations";

export const investigationStatusEnum = pgEnum("investigation_status", [
  "pending", "in_progress", "completed", "cancelled"
]);

export const investigationsTable = pgTable("investigations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  patientId: text("patient_id").notNull().references(() => patientsTable.id),
  patientName: text("patient_name"),
  consultationId: text("consultation_id").references(() => consultationsTable.id),
  requestedById: text("requested_by_id").notNull().references(() => usersTable.id),
  requestedByName: text("requested_by_name"),
  type: text("type").notNull(),
  bodyPart: text("body_part"),
  notes: text("notes"),
  status: investigationStatusEnum("status").notNull().default("pending"),
  resultNotes: text("result_notes"),
  imageAttachment: text("image_attachment"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertInvestigationSchema = createInsertSchema(investigationsTable).omit({
  id: true, createdAt: true, updatedAt: true, completedAt: true
});
export type InsertInvestigation = z.infer<typeof insertInvestigationSchema>;
export type Investigation = typeof investigationsTable.$inferSelect;
