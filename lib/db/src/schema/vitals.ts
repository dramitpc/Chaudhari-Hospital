import { pgTable, text, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { patientsTable } from "./patients";
import { consultationsTable } from "./consultations";

export const vitalsTable = pgTable("vitals", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  patientId: text("patient_id").notNull().references(() => patientsTable.id),
  consultationId: text("consultation_id").references(() => consultationsTable.id),
  temperature: text("temperature"),
  bloodPressureSystolic: integer("blood_pressure_systolic"),
  bloodPressureDiastolic: integer("blood_pressure_diastolic"),
  pulseRate: integer("pulse_rate"),
  respiratoryRate: integer("respiratory_rate"),
  oxygenSaturation: real("oxygen_saturation"),
  weight: real("weight"),
  height: real("height"),
  bmi: real("bmi"),
  notes: text("notes"),
  recordedById: text("recorded_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVitalsSchema = createInsertSchema(vitalsTable).omit({ id: true, recordedAt: true });
export type InsertVitals = z.infer<typeof insertVitalsSchema>;
export type Vitals = typeof vitalsTable.$inferSelect;
