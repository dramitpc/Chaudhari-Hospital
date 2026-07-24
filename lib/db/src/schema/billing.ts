import { pgTable, text, real, integer, boolean, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { patientsTable } from "./patients";
import { consultationsTable } from "./consultations";

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft", "pending", "paid", "partial", "cancelled", "refunded"
]);

export const paymentModeEnum = pgEnum("payment_mode", ["cash", "card", "upi", "insurance"]);

export const chargeTypeCategoryEnum = pgEnum("charge_type_category", [
  "consultation", "procedure", "investigation", "other"
]);

export const chargeTypesTable = pgTable("charge_types", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  category: chargeTypeCategoryEnum("category").notNull(),
  unitPrice: real("unit_price").notNull(),
  taxPercent: real("tax_percent").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invoicesTable = pgTable("invoices", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  invoiceNumber: text("invoice_number").notNull().unique(),
  patientId: text("patient_id").notNull().references(() => patientsTable.id),
  consultationId: text("consultation_id").references(() => consultationsTable.id),
  doctorId: text("doctor_id").references(() => usersTable.id, { onDelete: "set null" }),
  items: jsonb("items").notNull().default([]),
  subtotal: real("subtotal").notNull().default(0),
  discount: real("discount").notNull().default(0),
  tax: real("tax").notNull().default(0),
  total: real("total").notNull().default(0),
  amountPaid: real("amount_paid").notNull().default(0),
  balance: real("balance").notNull().default(0),
  paymentMode: paymentModeEnum("payment_mode"),
  status: invoiceStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  createdById: text("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const invoicePaymentsTable = pgTable("invoice_payments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  invoiceId: text("invoice_id").notNull().references(() => invoicesTable.id),
  amount: real("amount").notNull(),
  paymentMode: paymentModeEnum("payment_mode").notNull(),
  notes: text("notes"),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
  createdById: text("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, invoiceNumber: true, createdAt: true, updatedAt: true });
export const insertChargeTypeSchema = createInsertSchema(chargeTypesTable).omit({ id: true, createdAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
export type ChargeType = typeof chargeTypesTable.$inferSelect;
export type InvoicePayment = typeof invoicePaymentsTable.$inferSelect;
