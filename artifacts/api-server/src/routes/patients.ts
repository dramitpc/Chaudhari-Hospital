import { Router } from "express";
import { eq, ilike, or, desc } from "drizzle-orm";
import { db, patientsTable, consultationsTable, prescriptionsTable, vitalsTable, certificatesTable, usersTable } from "@workspace/db";
import {
  ListPatientsQueryParams,
  RegisterPatientBody,
  GetPatientParams,
  UpdatePatientParams,
  UpdatePatientBody,
  GetPatientHistoryParams,
  GetPatientTimelineParams,
  AddVitalsParams,
  AddVitalsBody,
} from "@workspace/api-zod";
import { authenticate } from "../middlewares/authenticate";
import { logAudit } from "../lib/auth";

const router = Router();

let patientCounter = 1000;

function formatPatient(p: typeof patientsTable.$inferSelect) {
  return {
    id: p.id,
    patientId: p.patientId,
    fullName: p.fullName,
    dateOfBirth: p.dateOfBirth,
    gender: p.gender,
    phone: p.phone ?? null,
    email: p.email ?? null,
    address: p.address ?? null,
    bloodGroup: p.bloodGroup ?? null,
    emergencyContactName: p.emergencyContactName ?? null,
    emergencyContactPhone: p.emergencyContactPhone ?? null,
    allergies: p.allergies ?? null,
    medicalHistory: p.medicalHistory ?? null,
    surgicalHistory: p.surgicalHistory ?? null,
    familyHistory: p.familyHistory ?? null,
    currentMedications: p.currentMedications ?? null,
    referringDoctorName: p.referringDoctorName ?? null,
    referringDoctorPhone: p.referringDoctorPhone ?? null,
    preferredLanguage: p.preferredLanguage ?? "en",
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

router.get("/patients", authenticate, async (req, res): Promise<void> => {
  const params = ListPatientsQueryParams.safeParse(req.query);
  const page = params.success && params.data.page ? Number(params.data.page) : 1;
  const limit = params.success && params.data.limit ? Number(params.data.limit) : 20;
  const search = params.success ? params.data.search : undefined;

  let query = db.select().from(patientsTable).$dynamic();
  if (search) {
    query = query.where(
      or(
        ilike(patientsTable.fullName, `%${search}%`),
        ilike(patientsTable.phone, `%${search}%`),
        ilike(patientsTable.patientId, `%${search}%`)
      )
    );
  }

  const all = await query.orderBy(desc(patientsTable.createdAt));
  const total = all.length;
  const data = all.slice((page - 1) * limit, page * limit).map(formatPatient);
  await logAudit(req, req.user!.id, "LIST_PATIENTS", "patients");
  res.json({ data, total, page, limit });
});

router.post("/patients", authenticate, async (req, res): Promise<void> => {
  const parsed = RegisterPatientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const count = await db.select().from(patientsTable);
  const nextNum = count.length + 1001;
  const patientId = `P${String(nextNum).padStart(5, "0")}`;
  const [patient] = await db.insert(patientsTable).values({ ...parsed.data, patientId }).returning();
  await logAudit(req, req.user!.id, "CREATE_PATIENT", "patients", patient.id);
  res.status(201).json(formatPatient(patient));
});

router.get("/patients/:id", authenticate, async (req, res): Promise<void> => {
  const params = GetPatientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, params.data.id));
  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }
  await logAudit(req, req.user!.id, "VIEW_PATIENT", "patients", patient.id);
  res.json(formatPatient(patient));
});

router.patch("/patients/:id", authenticate, async (req, res): Promise<void> => {
  const params = UpdatePatientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdatePatientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [patient] = await db.update(patientsTable).set(parsed.data).where(eq(patientsTable.id, params.data.id)).returning();
  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }
  await logAudit(req, req.user!.id, "UPDATE_PATIENT", "patients", patient.id);
  res.json(formatPatient(patient));
});

router.get("/patients/:id/history", authenticate, async (req, res): Promise<void> => {
  const params = GetPatientHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, params.data.id));
  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }
  const [consultations, prescriptions, vitals, certificates] = await Promise.all([
    db.select().from(consultationsTable).where(eq(consultationsTable.patientId, params.data.id)).orderBy(desc(consultationsTable.visitDate)),
    db.select().from(prescriptionsTable).where(eq(prescriptionsTable.patientId, params.data.id)).orderBy(desc(prescriptionsTable.visitDate)),
    db.select().from(vitalsTable).where(eq(vitalsTable.patientId, params.data.id)).orderBy(desc(vitalsTable.recordedAt)),
    db.select().from(certificatesTable).where(eq(certificatesTable.patientId, params.data.id)).orderBy(desc(certificatesTable.issuedDate)),
  ]);
  await logAudit(req, req.user!.id, "VIEW_PATIENT_HISTORY", "patients", params.data.id);
  res.json({
    patient: formatPatient(patient),
    consultations,
    prescriptions,
    vitals,
    certificates,
  });
});

router.post("/patients/:id/vitals", authenticate, async (req, res): Promise<void> => {
  const params = AddVitalsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = AddVitalsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const bmi = parsed.data.weight && parsed.data.height
    ? Number((parsed.data.weight / ((parsed.data.height / 100) ** 2)).toFixed(1))
    : null;
  const [vitals] = await db.insert(vitalsTable).values({
    ...parsed.data,
    patientId: params.data.id,
    recordedById: req.user!.id,
    bmi: bmi ?? undefined,
  }).returning();
  res.status(201).json(vitals);
});

router.get("/patients/:id/timeline", authenticate, async (req, res): Promise<void> => {
  const params = GetPatientTimelineParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [consultations, prescriptions, vitals, billings, certificates] = await Promise.all([
    db.select({ id: consultationsTable.id, date: consultationsTable.visitDate, notes: consultationsTable.clinicalNotes, doctorId: consultationsTable.doctorId }).from(consultationsTable).where(eq(consultationsTable.patientId, params.data.id)),
    db.select({ id: prescriptionsTable.id, date: prescriptionsTable.visitDate, doctorId: prescriptionsTable.doctorId }).from(prescriptionsTable).where(eq(prescriptionsTable.patientId, params.data.id)),
    db.select({ id: vitalsTable.id, date: vitalsTable.recordedAt }).from(vitalsTable).where(eq(vitalsTable.patientId, params.data.id)),
    db.select({ id: vitalsTable.id, date: vitalsTable.recordedAt }).from(vitalsTable).where(eq(vitalsTable.patientId, params.data.id)),
    db.select({ id: certificatesTable.id, date: certificatesTable.issuedDate, type: certificatesTable.type, doctorId: certificatesTable.doctorId }).from(certificatesTable).where(eq(certificatesTable.patientId, params.data.id)),
  ]);

  const events: { id: string; type: string; date: string; description: string; referenceId: string | null; doctorName: string | null }[] = [];

  for (const c of consultations) {
    const [doc] = await db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, c.doctorId));
    events.push({ id: c.id, type: "consultation", date: c.date, description: c.notes ?? "Consultation visit", referenceId: c.id, doctorName: doc?.fullName ?? null });
  }
  for (const p of prescriptions) {
    const [doc] = await db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, p.doctorId));
    events.push({ id: p.id, type: "prescription", date: p.date, description: "Prescription issued", referenceId: p.id, doctorName: doc?.fullName ?? null });
  }
  for (const v of vitals) {
    events.push({ id: v.id, type: "vitals", date: v.date.toISOString().split("T")[0], description: "Vitals recorded", referenceId: v.id, doctorName: null });
  }
  for (const cert of certificates) {
    const [doc] = await db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, cert.doctorId));
    events.push({ id: cert.id, type: "certificate", date: cert.date, description: `${cert.type.replace("_", " ")} certificate`, referenceId: cert.id, doctorName: doc?.fullName ?? null });
  }

  events.sort((a, b) => b.date.localeCompare(a.date));
  res.json(events);
});

export default router;
