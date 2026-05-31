import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { patientsTable } from "./patients";
import { consultationsTable } from "./consultations";

export const prescriptionsTable = pgTable("prescriptions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  patientId: text("patient_id").notNull().references(() => patientsTable.id),
  doctorId: text("doctor_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  consultationId: text("consultation_id").references(() => consultationsTable.id),
  visitDate: text("visit_date").notNull(),
  diagnosis: text("diagnosis"),
  advice: text("advice"),
  followUpDate: text("follow_up_date"),
  items: jsonb("items").notNull().default([]),
  notes: text("notes"),
  patientLanguage: text("patient_language").default("en"),
  translations: jsonb("translations"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const prescriptionTemplatesTable = pgTable("prescription_templates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  doctorId: text("doctor_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  items: jsonb("items").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPrescriptionSchema = createInsertSchema(prescriptionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPrescriptionTemplateSchema = createInsertSchema(prescriptionTemplatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPrescription = z.infer<typeof insertPrescriptionSchema>;
export type Prescription = typeof prescriptionsTable.$inferSelect;
export type PrescriptionTemplate = typeof prescriptionTemplatesTable.$inferSelect;
