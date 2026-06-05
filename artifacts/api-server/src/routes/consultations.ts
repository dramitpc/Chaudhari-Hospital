import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, consultationsTable, patientsTable, usersTable, queueTokensTable } from "@workspace/db";
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
import { logAudit } from "../lib/auth";

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

  const all = await query.orderBy(desc(consultationsTable.visitDate));
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
  const visitDate = new Date().toISOString().split("T")[0];
  const [c] = await db.insert(consultationsTable).values({ ...parsed.data, visitDate }).returning();
  await logAudit(req, req.user!.id, "CREATE_CONSULTATION", "consultations", c.id, `Patient: ${c.patientId}`);
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
  await logAudit(req, req.user!.id, "COMPLETE_CONSULTATION", "consultations", c.id);
  res.json(await formatConsultation(c));
});

export default router;
