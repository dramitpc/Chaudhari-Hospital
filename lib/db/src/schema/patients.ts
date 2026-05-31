import { pgTable, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const genderEnum = pgEnum("gender", ["male", "female", "other"]);

export const patientsTable = pgTable("patients", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  patientId: text("patient_id").notNull().unique(),
  fullName: text("full_name").notNull(),
  dateOfBirth: text("date_of_birth"),
  age: text("age"),
  gender: genderEnum("gender").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  bloodGroup: text("blood_group"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  allergies: text("allergies"),
  medicalHistory: text("medical_history"),
  surgicalHistory: text("surgical_history"),
  familyHistory: text("family_history"),
  currentMedications: text("current_medications"),
  referringDoctorName: text("referring_doctor_name"),
  referringDoctorPhone: text("referring_doctor_phone"),
  preferredLanguage: text("preferred_language").default("en"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPatientSchema = createInsertSchema(patientsTable).omit({ id: true, patientId: true, createdAt: true, updatedAt: true });
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patientsTable.$inferSelect;
