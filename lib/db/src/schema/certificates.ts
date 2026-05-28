import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { patientsTable } from "./patients";
import { consultationsTable } from "./consultations";

export const certificateTypeEnum = pgEnum("certificate_type", [
  "sick_leave", "fitness", "medical", "procedure", "vaccination", "referral_thank_you"
]);

export const certificatesTable = pgTable("certificates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  patientId: text("patient_id").notNull().references(() => patientsTable.id),
  doctorId: text("doctor_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  consultationId: text("consultation_id").references(() => consultationsTable.id),
  type: certificateTypeEnum("type").notNull(),
  issuedDate: text("issued_date").notNull(),
  fromDate: text("from_date"),
  toDate: text("to_date"),
  diagnosis: text("diagnosis"),
  content: text("content"),
  qrCode: text("qr_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCertificateSchema = createInsertSchema(certificatesTable).omit({ id: true, qrCode: true, createdAt: true });
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type Certificate = typeof certificatesTable.$inferSelect;
