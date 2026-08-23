import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, consultationsTable, patientsTable, usersTable, queueTokensTable, invoicesTable, investigationsTable, chargeTypesTable } from "@workspace/db";
import {
  ListConsultationsQueryParams,
  CreateConsultationBody,
  GetConsultationParams,
  UpdateConsultationParams,
  UpdateConsultationBody,
  CompleteConsultationParams,
  CompleteConsultationBody,
} from "@workspace/api-zod";
import { authenticate } from "../middlewares/authenticate";
import { verifyPassword } from "../lib/auth";
import { logAudit } from "../lib/auth";
import { localDateStr } from "../lib/date";

const router = Router();

async function formatConsultation(c: typeof consultationsTable.$inferSelect) {
  const [patient] = await db.select({ salutation: patientsTable.salutation, fullName: patientsTable.fullName }).from(patientsTable).where(eq(patientsTable.id, c.patientId));
  const [doctor] = await db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, c.doctorId));
  const [token] = c.tokenId
    ? await db.select({ visitType: queueTokensTable.visitType }).from(queueTokensTable).where(eq(queueTokensTable.id, c.tokenId))
    : [null];
  return {
    id: c.id,
    patientId: c.patientId,
    patientName: [patient?.salutation, patient?.fullName].filter(Boolean).join(" ") || "",
    doctorId: c.doctorId,
    doctorName: doctor?.fullName ?? "",
    appointmentId: c.appointmentId ?? null,
    tokenId: c.tokenId ?? null,
    visitDate: c.visitDate,
    status: c.status,
    referringDoctorName: c.referringDoctorName ?? null,
    chiefComplaint: c.chiefComplaint ?? null,
    historyOfPresentIllness: c.historyOfPresentIllness ?? null,
    clinicalNotes: c.clinicalNotes ?? null,
    soapSubjective: c.soapSubjective ?? null,
    soapObjective: c.soapObjective ?? null,
    soapAssessment: c.soapAssessment ?? null,
    soapPlan: c.soapPlan ?? null,
    diagnosis: c.diagnosis ?? null,
    icd10Code: c.icd10Code ?? null,
    advice: c.advice ?? null,
    followUpDate: c.followUpDate ?? null,
    followUpNotes: c.followUpNotes ?? null,
    investigationOrders: c.investigationOrders ?? null,
    clinicalAttachments: c.clinicalAttachments ?? null,
    vitals: c.vitals ?? null,
    visitType: token?.visitType ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

router.get("/consultations", authenticate, async (req, res): Promise<void> => {
  const params = ListConsultationsQueryParams.safeParse(req.query);
  const page = params.success && params.data.page ? Number(params.data.page) : 1;
  const limit = params.success && params.data.limit ? Number(params.data.limit) : 20;

  let query = db.select().from(consultationsTable).$dynamic();
  if (params.success && params.data.patientId) query = query.where(eq(consultationsTable.patientId, params.data.patientId));
  if (params.success && params.data.doctorId) query = query.where(eq(consultationsTable.doctorId, params.data.doctorId));
  if (params.success && params.data.date) query = query.where(eq(consultationsTable.visitDate, params.data.date));

  const all = await query.orderBy(desc(consultationsTable.createdAt));
  const total = all.length;
  const slice = all.slice((page - 1) * limit, page * limit);
  const data = await Promise.all(slice.map(formatConsultation));
  res.json({ data, total, page, limit });
});

router.post("/consultations", authenticate, async (req, res): Promise<void> => {
  const parsed = CreateConsultationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tokenRow = parsed.data.tokenId
    ? (await db.select({ queueDate: queueTokensTable.queueDate, visitType: queueTokensTable.visitType }).from(queueTokensTable).where(eq(queueTokensTable.id, parsed.data.tokenId)))[0]
    : null;
  const visitDate = tokenRow?.queueDate ?? localDateStr();
  const [c] = await db.insert(consultationsTable).values({ ...parsed.data, visitDate }).returning();
  await logAudit(req, req.user!.id, "CREATE_CONSULTATION", "consultations", c.id, `Patient: ${c.patientId}`);

  // Auto-generate invoice with consultation fee — new visits only, not follow-ups
  const isNewVisit = !tokenRow || tokenRow.visitType === "new";
  const consultationCharge = isNewVisit
    ? await db.select().from(chargeTypesTable)
        .where(and(eq(chargeTypesTable.category, "consultation"), eq(chargeTypesTable.isActive, true)))
    : [];
  const charge = consultationCharge[0];
  if (charge) {
    const item = { chargeTypeId: charge.id, description: charge.name, quantity: 1, unitPrice: charge.unitPrice, tax: 0, total: charge.unitPrice };
    const now = new Date();
    const y = now.getFullYear().toString().slice(-2);
    const mo = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const rand = Math.floor(Math.random() * 9000) + 1000;
    await db.insert(invoicesTable).values({
      invoiceNumber: `INV-${y}${mo}${d}-${rand}`,
      patientId: c.patientId,
      consultationId: c.id,
      doctorId: c.doctorId,
      items: [item],
      subtotal: charge.unitPrice,
      discount: 0,
      tax: 0,
      total: charge.unitPrice,
      amountPaid: 0,
      balance: charge.unitPrice,
      status: "pending",
      createdById: req.user!.id,
    });
  }

  res.status(201).json(await formatConsultation(c));
});

router.get("/consultations/:id", authenticate, async (req, res): Promise<void> => {
  const params = GetConsultationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [c] = await db.select().from(consultationsTable).where(eq(consultationsTable.id, params.data.id));
  if (!c) {
    res.status(404).json({ error: "Consultation not found" });
    return;
  }
  await logAudit(req, req.user!.id, "VIEW_CONSULTATION", "consultations", c.id);
  res.json(await formatConsultation(c));
});

router.patch("/consultations/:id", authenticate, async (req, res): Promise<void> => {
  const params = UpdateConsultationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateConsultationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [c] = await db.update(consultationsTable).set(parsed.data).where(eq(consultationsTable.id, params.data.id)).returning();
  if (!c) {
    res.status(404).json({ error: "Consultation not found" });
    return;
  }
  await logAudit(req, req.user!.id, "UPDATE_CONSULTATION", "consultations", c.id);
  res.json(await formatConsultation(c));
});

router.post("/consultations/:id/complete", authenticate, async (req, res): Promise<void> => {
  const params = CompleteConsultationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = CompleteConsultationBody.safeParse(req.body);

  // Check for unpaid invoices on this consultation
  const unpaidInvoices = await db.select().from(invoicesTable).where(
    and(eq(invoicesTable.consultationId, params.data.id),
      and(
        // balance > 0 — drizzle doesn't have gt for columns easily, filter in JS
        eq(invoicesTable.consultationId, params.data.id)
      )
    )
  );
  const totalUnpaid = unpaidInvoices
    .filter(inv => !["paid", "cancelled", "refunded"].includes(inv.status) && (inv.balance ?? 0) > 0)
    .reduce((s, inv) => s + (inv.balance ?? 0), 0);

  if (totalUnpaid > 0) {
    // Require an override: either a reason code or valid manager credentials
    const body = parsed.success ? parsed.data : (req.body as Record<string, string>);
    const overrideReason = body.overrideReason as string | undefined;
    const managerUsername = body.managerUsername as string | undefined;
    const managerPassword = body.managerPassword as string | undefined;

    if (!overrideReason && (!managerUsername || !managerPassword)) {
      res.status(402).json({
        error: "UNPAID_BALANCE",
        message: `This consultation has an outstanding balance of ₹${totalUnpaid.toFixed(2)}. Provide an override reason or manager credentials to complete.`,
        balance: totalUnpaid,
      });
      return;
    }

    // If manager credentials provided, verify them
    if (managerUsername && managerPassword) {
      const [manager] = await db.select().from(usersTable)
        .where(eq(usersTable.username, managerUsername));
      const validManager = manager && ["admin", "staff"].includes(manager.role) && verifyPassword(managerPassword, manager.passwordHash);
      if (!validManager) {
        res.status(403).json({ error: "INVALID_MANAGER", message: "Invalid manager credentials or insufficient role." });
        return;
      }
      await logAudit(req, req.user!.id, "COMPLETE_CONSULTATION_OVERRIDE", "consultations", params.data.id,
        `Manager override by ${manager.fullName} (${manager.username}). Unpaid balance: ₹${totalUnpaid.toFixed(2)}`);
    } else {
      await logAudit(req, req.user!.id, "COMPLETE_CONSULTATION_OVERRIDE", "consultations", params.data.id,
        `Reason override: ${overrideReason}. Unpaid balance: ₹${totalUnpaid.toFixed(2)}`);
    }
  }

  const updates: Partial<typeof consultationsTable.$inferInsert> = { status: "completed" };
  if (parsed.success) {
    if (parsed.data.diagnosis) updates.diagnosis = parsed.data.diagnosis;
    if (parsed.data.advice) updates.advice = parsed.data.advice;
    if (parsed.data.followUpDate) updates.followUpDate = parsed.data.followUpDate;
  }
  const [c] = await db.update(consultationsTable).set(updates).where(eq(consultationsTable.id, params.data.id)).returning();
  if (!c) {
    res.status(404).json({ error: "Consultation not found" });
    return;
  }
  if (c.tokenId) {
    await db.update(queueTokensTable)
      .set({ status: "consultation_done", consultationEndedAt: new Date() })
      .where(eq(queueTokensTable.id, c.tokenId));
  }

  await logAudit(req, req.user!.id, "COMPLETE_CONSULTATION", "consultations", c.id);
  res.json(await formatConsultation(c));
});

export default router;
