import { pgTable, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { patientsTable } from "./patients";
import { appointmentsTable } from "./appointments";

export const queueStatusEnum = pgEnum("queue_status", [
  "waiting", "called", "in_consultation", "completed", "skipped", "cancelled"
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
  queueDate: text("queue_date").notNull(),
  consultationStartedAt: timestamp("consultation_started_at", { withTimezone: true }),
  consultationEndedAt: timestamp("consultation_ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertQueueTokenSchema = createInsertSchema(queueTokensTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQueueToken = z.infer<typeof insertQueueTokenSchema>;
export type QueueToken = typeof queueTokensTable.$inferSelect;
