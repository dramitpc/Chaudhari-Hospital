import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, prescriptionsTable, prescriptionTemplatesTable, patientsTable, usersTable } from "@workspace/db";
import {
  ListPrescriptionsQueryParams,
  CreatePrescriptionBody,
  GetPrescriptionParams,
  UpdatePrescriptionParams,
  UpdatePrescriptionBody,
  ListPrescriptionTemplatesQueryParams,
  CreatePrescriptionTemplateBody,
} from "@workspace/api-zod";
import { authenticate } from "../middlewares/authenticate";
import { logAudit } from "../lib/auth";

const router = Router();

async function formatPrescription(p: typeof prescriptionsTable.$inferSelect) {
  const [patient] = await db.select({ fullName: patientsTable.fullName }).from(patientsTable).where(eq(patientsTable.id, p.patientId));
  const [doctor] = await db.select({ fullName: usersTable.fullName, registrationNumber: usersTable.registrationNumber }).from(usersTable).where(eq(usersTable.id, p.doctorId));
  return {
    id: p.id,
    patientId: p.patientId,
    patientName: patient?.fullName ?? "",
    doctorId: p.doctorId,
    doctorName: doctor?.fullName ?? "",
    doctorRegistrationNumber: doctor?.registrationNumber ?? null,
    consultationId: p.consultationId ?? null,
    visitDate: p.visitDate,
    diagnosis: p.diagnosis ?? null,
    advice: p.advice ?? null,
    followUpDate: p.followUpDate ?? null,
    items: (p.items as unknown[]) ?? [],
    notes: p.notes ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/prescriptions/templates", authenticate, async (req, res): Promise<void> => {
  const params = ListPrescriptionTemplatesQueryParams.safeParse(req.query);
  let query = db.select().from(prescriptionTemplatesTable).$dynamic();
  if (params.success && params.data.doctorId) {
    query = query.where(eq(prescriptionTemplatesTable.doctorId, params.data.doctorId));
  }
  const templates = await query.orderBy(desc(prescriptionTemplatesTable.createdAt));
  res.json(templates.map(t => ({
    id: t.id,
    doctorId: t.doctorId,
    name: t.name,
    description: t.description ?? null,
    items: (t.items as unknown[]) ?? [],
    createdAt: t.createdAt.toISOString(),
  })));
});

router.post("/prescriptions/templates", authenticate, async (req, res): Promise<void> => {
  const parsed = CreatePrescriptionTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [template] = await db.insert(prescriptionTemplatesTable).values(parsed.data as Parameters<typeof db.insert>[0] extends typeof prescriptionTemplatesTable ? never : typeof parsed.data).returning();
  res.status(201).json({
    id: template.id,
    doctorId: template.doctorId,
    name: template.name,
    description: template.description ?? null,
    items: (template.items as unknown[]) ?? [],
    createdAt: template.createdAt.toISOString(),
  });
});

router.get("/prescriptions", authenticate, async (req, res): Promise<void> => {
  const params = ListPrescriptionsQueryParams.safeParse(req.query);
  const page = params.success && params.data.page ? Number(params.data.page) : 1;
  const limit = params.success && params.data.limit ? Number(params.data.limit) : 20;

  let query = db.select().from(prescriptionsTable).$dynamic();
  if (params.success && params.data.patientId) query = query.where(eq(prescriptionsTable.patientId, params.data.patientId));
  if (params.success && params.data.consultationId) query = query.where(eq(prescriptionsTable.consultationId, params.data.consultationId));

  const all = await query.orderBy(desc(prescriptionsTable.visitDate));
  const total = all.length;
  const slice = all.slice((page - 1) * limit, page * limit);
  const data = await Promise.all(slice.map(formatPrescription));
  res.json({ data, total, page, limit });
});

router.post("/prescriptions", authenticate, async (req, res): Promise<void> => {
  const parsed = CreatePrescriptionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const visitDate = new Date().toISOString().split("T")[0];
  const [p] = await db.insert(prescriptionsTable).values({ ...parsed.data, visitDate }).returning();
  await logAudit(req, req.user!.id, "CREATE_PRESCRIPTION", "prescriptions", p.id);
  res.status(201).json(await formatPrescription(p));
});

router.get("/prescriptions/:id", authenticate, async (req, res): Promise<void> => {
  const params = GetPrescriptionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [p] = await db.select().from(prescriptionsTable).where(eq(prescriptionsTable.id, params.data.id));
  if (!p) {
    res.status(404).json({ error: "Prescription not found" });
    return;
  }
  await logAudit(req, req.user!.id, "VIEW_PRESCRIPTION", "prescriptions", p.id);
  res.json(await formatPrescription(p));
});

router.patch("/prescriptions/:id", authenticate, async (req, res): Promise<void> => {
  const params = UpdatePrescriptionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdatePrescriptionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [p] = await db.update(prescriptionsTable).set(parsed.data as Partial<typeof prescriptionsTable.$inferInsert>).where(eq(prescriptionsTable.id, params.data.id)).returning();
  if (!p) {
    res.status(404).json({ error: "Prescription not found" });
    return;
  }
  await logAudit(req, req.user!.id, "UPDATE_PRESCRIPTION", "prescriptions", p.id);
  res.json(await formatPrescription(p));
});

export default router;
