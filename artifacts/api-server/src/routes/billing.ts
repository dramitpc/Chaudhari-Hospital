import { Router } from "express";
import { eq, desc, gte, lt, and } from "drizzle-orm";
import { db, invoicesTable, chargeTypesTable, patientsTable, usersTable } from "@workspace/db";
import {
  ListInvoicesQueryParams,
  CreateInvoiceBody,
  GetInvoiceParams,
  UpdateInvoiceParams,
  UpdateInvoiceBody,
  RecordPaymentParams,
  RecordPaymentBody,
  CreateChargeTypeBody,
} from "@workspace/api-zod";
import { authenticate, requireRole } from "../middlewares/authenticate";
import { logAudit } from "../lib/auth";

const router = Router();

async function formatInvoice(inv: typeof invoicesTable.$inferSelect) {
  const [patient] = await db.select({ salutation: patientsTable.salutation, fullName: patientsTable.fullName }).from(patientsTable).where(eq(patientsTable.id, inv.patientId));
  const doctor = inv.doctorId ? await db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, inv.doctorId)) : [];
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    patientId: inv.patientId,
    patientName: [patient?.salutation, patient?.fullName].filter(Boolean).join(" ") || "",
    consultationId: inv.consultationId ?? null,
    doctorId: inv.doctorId ?? null,
    doctorName: doctor[0]?.fullName ?? null,
    items: (inv.items as unknown[]) ?? [],
    subtotal: inv.subtotal,
    discount: inv.discount,
    tax: inv.tax,
    total: inv.total,
    amountPaid: inv.amountPaid,
    balance: inv.balance,
    paymentMode: inv.paymentMode ?? null,
    status: inv.status,
    notes: inv.notes ?? null,
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
  };
}

function generateInvoiceNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `INV-${y}${m}${d}-${rand}`;
}

router.get("/billing/invoices", authenticate, async (req, res): Promise<void> => {
  const params = ListInvoicesQueryParams.safeParse(req.query);
  const page = params.success && params.data.page ? Number(params.data.page) : 1;
  const limit = params.success && params.data.limit ? Number(params.data.limit) : 20;

  let query = db.select().from(invoicesTable).$dynamic();
  if (params.success && params.data.patientId) query = query.where(eq(invoicesTable.patientId, params.data.patientId));
  if (params.success && params.data.status) query = query.where(eq(invoicesTable.status, params.data.status as "draft" | "pending" | "paid" | "partial" | "cancelled" | "refunded"));
  if (params.success && params.data.date) {
    const dayStart = new Date(params.data.date + "T00:00:00.000Z");
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    query = query.where(and(gte(invoicesTable.createdAt, dayStart), lt(invoicesTable.createdAt, dayEnd)));
  }

  const all = await query.orderBy(desc(invoicesTable.createdAt));
  const total = all.length;
  const slice = all.slice((page - 1) * limit, page * limit);
  const data = await Promise.all(slice.map(formatInvoice));
  res.json({ data, total, page, limit });
});

router.post("/billing/invoices", authenticate, async (req, res): Promise<void> => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const items = (parsed.data.items as Array<{ quantity: number; unitPrice: number; discount?: number; tax?: number; total: number }>) ?? [];
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const discountAmt = parsed.data.discount ?? 0;
  const taxAmt = items.reduce((s, i) => s + (i.tax ?? 0), 0);
  const total = subtotal - discountAmt + taxAmt;

  const [inv] = await db.insert(invoicesTable).values({
    invoiceNumber: generateInvoiceNumber(),
    patientId: parsed.data.patientId,
    consultationId: parsed.data.consultationId,
    doctorId: parsed.data.doctorId,
    items: parsed.data.items as typeof invoicesTable.$inferInsert["items"],
    subtotal,
    discount: discountAmt,
    tax: taxAmt,
    total,
    amountPaid: 0,
    balance: total,
    status: "pending",
    notes: parsed.data.notes,
    createdById: req.user!.id,
  }).returning();

  await logAudit(req, req.user!.id, "CREATE_INVOICE", "billing", inv.id);
  res.status(201).json(await formatInvoice(inv));
});

router.get("/billing/invoices/:id", authenticate, async (req, res): Promise<void> => {
  const params = GetInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, params.data.id));
  if (!inv) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  res.json(await formatInvoice(inv));
});

router.patch("/billing/invoices/:id", authenticate, async (req, res): Promise<void> => {
  const params = UpdateInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates: Partial<typeof invoicesTable.$inferInsert> = {};
  if (parsed.data.items) {
    const existing = await db.query.invoicesTable.findFirst({ where: eq(invoicesTable.id, params.data.id) });
    if (!existing) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    const items = parsed.data.items as Array<{ quantity: number; unitPrice: number; discount?: number; tax?: number; total: number }>;
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const taxAmt = items.reduce((s, i) => s + (i.tax ?? 0), 0);
    const discountAmt = parsed.data.discount ?? 0;
    const total = subtotal - discountAmt + taxAmt;
    updates.items = parsed.data.items as typeof invoicesTable.$inferInsert["items"];
    updates.subtotal = subtotal;
    updates.tax = taxAmt;
    updates.discount = discountAmt;
    updates.total = total;
    updates.balance = Math.max(0, total - (existing.amountPaid ?? 0));
  }
  if (parsed.data.notes) updates.notes = parsed.data.notes;
  if (parsed.data.status) updates.status = parsed.data.status as typeof invoicesTable.$inferInsert["status"];
  const [inv] = await db.update(invoicesTable).set(updates).where(eq(invoicesTable.id, params.data.id)).returning();
  if (!inv) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  res.json(await formatInvoice(inv));
});

router.post("/billing/invoices/:id/pay", authenticate, async (req, res): Promise<void> => {
  const params = RecordPaymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = RecordPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  const newPaid = existing.amountPaid + parsed.data.amount;
  const newBalance = existing.total - newPaid;
  const status = newBalance <= 0 ? "paid" : "partial";
  const [inv] = await db.update(invoicesTable).set({
    amountPaid: newPaid,
    balance: Math.max(0, newBalance),
    status,
    paymentMode: parsed.data.paymentMode as typeof invoicesTable.$inferInsert["paymentMode"],
  }).where(eq(invoicesTable.id, params.data.id)).returning();
  await logAudit(req, req.user!.id, "RECORD_PAYMENT", "billing", inv.id, `Amount: ${parsed.data.amount}, Mode: ${parsed.data.paymentMode}`);
  res.json(await formatInvoice(inv));
});

router.get("/billing/charge-types", authenticate, async (req, res): Promise<void> => {
  const types = await db.select().from(chargeTypesTable).where(eq(chargeTypesTable.isActive, true)).orderBy(chargeTypesTable.name);
  res.json(types.map(t => ({
    id: t.id,
    name: t.name,
    category: t.category,
    unitPrice: t.unitPrice,
    taxPercent: t.taxPercent,
    isActive: t.isActive,
  })));
});

router.post("/billing/charge-types", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = CreateChargeTypeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [ct] = await db.insert(chargeTypesTable).values(parsed.data as typeof chargeTypesTable.$inferInsert).returning();
  res.status(201).json({ id: ct.id, name: ct.name, category: ct.category, unitPrice: ct.unitPrice, taxPercent: ct.taxPercent, isActive: ct.isActive });
});

router.patch("/billing/charge-types/:id", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = CreateChargeTypeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [ct] = await db.update(chargeTypesTable)
    .set(parsed.data as Partial<typeof chargeTypesTable.$inferInsert>)
    .where(eq(chargeTypesTable.id, req.params.id))
    .returning();
  if (!ct) { res.status(404).json({ error: "Not found" }); return; }
  await logAudit(req, (req as { user?: { id: string } }).user?.id ?? "", "update", "charge_type", ct.id);
  res.json({ id: ct.id, name: ct.name, category: ct.category, unitPrice: ct.unitPrice, taxPercent: ct.taxPercent, isActive: ct.isActive });
});

router.delete("/billing/charge-types/:id", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const [ct] = await db.update(chargeTypesTable)
    .set({ isActive: false })
    .where(eq(chargeTypesTable.id, req.params.id))
    .returning();
  if (!ct) { res.status(404).json({ error: "Not found" }); return; }
  await logAudit(req, (req as { user?: { id: string } }).user?.id ?? "", "delete", "charge_type", ct.id);
  res.status(204).end();
});

export default router;
