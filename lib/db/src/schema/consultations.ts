import { pgTable, text, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { patientsTable } from "./patients";
import { appointmentsTable } from "./appointments";
import { queueTokensTable } from "./queue";

export const consultationStatusEnum = pgEnum("consultation_status", [
  "in_progress", "completed", "cancelled"
]);

export const consultationsTable = pgTable("consultations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  patientId: text("patient_id").notNull().references(() => patientsTable.id),
  doctorId: text("doctor_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  appointmentId: text("appointment_id").references(() => appointmentsTable.id),
  tokenId: text("token_id").references(() => queueTokensTable.id),
  visitDate: text("visit_date").notNull(),
  status: consultationStatusEnum("status").notNull().default("in_progress"),
  referringDoctorName: text("referring_doctor_name"),
  chiefComplaint: text("chief_complaint"),
  historyOfPresentIllness: text("history_of_present_illness"),
  clinicalNotes: text("clinical_notes"),
  soapSubjective: text("soap_subjective"),
  soapObjective: text("soap_objective"),
  soapAssessment: text("soap_assessment"),
  soapPlan: text("soap_plan"),
  diagnosis: text("diagnosis"),
  icd10Code: text("icd10_code"),
  advice: text("advice"),
  followUpDate: text("follow_up_date"),
  followUpNotes: text("follow_up_notes"),
  investigationOrders: text("investigation_orders"),
  clinicalAttachments: text("clinical_attachments"),
  vitals: jsonb("vitals"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertConsultationSchema = createInsertSchema(consultationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertConsultation = z.infer<typeof insertConsultationSchema>;
export type Consultation = typeof consultationsTable.$inferSelect;
