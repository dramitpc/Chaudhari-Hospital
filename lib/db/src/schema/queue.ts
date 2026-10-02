import { pgTable, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { patientsTable } from "./patients";
import { appointmentsTable } from "./appointments";

export const queueStatusEnum = pgEnum("queue_status", [
  "waiting", "called", "in_consultation", "paused", "awaiting_investigations", "ready_for_review", "consultation_done", "completed", "skipped", "cancelled"
]);

export const visitTypeEnum = pgEnum("visit_type", ["new", "followup"]);

export const queueTokensTable = pgTable("queue_tokens", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tokenNumber: integer("token_number").notNull(),
  patientId: text("patient_id").notNull().references(() => patientsTable.id),
  doctorId: text("doctor_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  appointmentId: text("appointment_id").references(() => appointmentsTable.id),
  status: queueStatusEnum("status").notNull().default("waiting"),
  visitType: visitTypeEnum("visit_type").notNull().default("new"),
  priority: integer("priority").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  queueDate: text("queue_date").notNull(),
  consultationStartedAt: timestamp("consultation_started_at", { withTimezone: true }),
  consultationEndedAt: timestamp("consultation_ended_at", { withTimezone: true }),
  activeStartedAt: timestamp("active_started_at", { withTimezone: true }),
  activeSeconds: integer("active_seconds"),
  initialSeconds: integer("initial_seconds"),
  reviewSeconds: integer("review_seconds").notNull().default(0),
  sessionCount: integer("session_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertQueueTokenSchema = createInsertSchema(queueTokensTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQueueToken = z.infer<typeof insertQueueTokenSchema>;
export type QueueToken = typeof queueTokensTable.$inferSelect;
