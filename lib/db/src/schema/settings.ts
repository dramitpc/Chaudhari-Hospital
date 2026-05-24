import { pgTable, text, real, integer, timestamp } from "drizzle-orm/pg-core";

export const clinicSettingsTable = pgTable("clinic_settings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clinicName: text("clinic_name").notNull().default("My Clinic"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  registrationNumber: text("registration_number"),
  taxId: text("tax_id"),
  currency: text("currency").notNull().default("INR"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  sessionTimeoutMinutes: integer("session_timeout_minutes").notNull().default(15),
  defaultConsultationFee: real("default_consultation_fee"),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ClinicSettings = typeof clinicSettingsTable.$inferSelect;
