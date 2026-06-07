import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, prescriptionsTable, prescriptionTemplatesTable, patientsTable, usersTable, consultationsTable } from "@workspace/db";
import {
  ListPrescriptionsQueryParams,
  CreatePrescriptionBody,
  GetPrescriptionParams,
  UpdatePrescriptionParams,
  UpdatePrescriptionBody,
  ListPrescriptionTemplatesQueryParams,
  CreatePrescriptionTemplateBody,
  TranslatePrescriptionParams,
  TranslatePrescriptionBody,
} from "@workspace/api-zod";
import { authenticate } from "../middlewares/authenticate";
import { logAudit } from "../lib/auth";
import { localDateStr } from "../lib/date";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", hi: "Hindi", mr: "Marathi", gu: "Gujarati",
  ta: "Tamil", te: "Telugu", kn: "Kannada", pa: "Punjabi", bn: "Bengali",
};

async function formatPrescription(p: typeof prescriptionsTable.$inferSelect) {
  const [patient] = await db.select({ salutation: patientsTable.salutation, fullName: patientsTable.fullName }).from(patientsTable).where(eq(patientsTable.id, p.patientId));
  const [doctor] = await db.select({ fullName: usersTable.fullName, registrationNumber: usersTable.registrationNumber, specialization: usersTable.specialization, consultingHours: usersTable.consultingHours, signatureData: usersTable.signatureData }).from(usersTable).where(eq(usersTable.id, p.doctorId));
  const consultation = p.consultationId
    ? (await db.select({
        chiefComplaint:    consultationsTable.chiefComplaint,
        soapSubjective:    consultationsTable.soapSubjective,
        soapObjective:     consultationsTable.soapObjective,
        soapAssessment:    consultationsTable.soapAssessment,
        soapPlan:          consultationsTable.soapPlan,
        investigationOrders: consultationsTable.investigationOrders,
        referenceTo:       consultationsTable.referenceTo,
      }).from(consultationsTable).where(eq(consultationsTable.id, p.consultationId)))[0]
    : null;
  return {
    id: p.id,
    patientId: p.patientId,
    patientName: [patient?.salutation, patient?.fullName].filter(Boolean).join(" ") || "",
    doctorId: p.doctorId,
    doctorName: doctor?.fullName ?? "",
    doctorRegistrationNumber: doctor?.registrationNumber ?? null,
    doctorSpecialization: doctor?.specialization ?? null,
    doctorConsultingHours: doctor?.consultingHours ?? null,
    doctorSignatureData: doctor?.signatureData ?? null,
    consultationId: p.consultationId ?? null,
    visitDate: p.visitDate,
    diagnosis: p.diagnosis ?? null,
    advice: p.advice ?? null,
    followUpDate: p.followUpDate ?? null,
    items: (p.items as unknown[]) ?? [],
    notes: p.notes ?? null,
    chiefComplaint:     consultation?.chiefComplaint     ?? null,
    soapSubjective:     consultation?.soapSubjective     ?? null,
    soapObjective:      consultation?.soapObjective      ?? null,
    soapAssessment:     consultation?.soapAssessment     ?? null,
    soapPlan:           consultation?.soapPlan           ?? null,
    investigationOrders: consultation?.investigationOrders ?? null,
    referenceTo: consultation?.referenceTo ?? null,
    patientLanguage: p.patientLanguage ?? "en",
    translations: (p.translations ?? null) as Record<string, unknown> | null,
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
  const limit = params.success && params.data.limit ? Number(params.data.limit) : 50;
  const localToday = new Date().toLocaleDateString("en-CA");
  const date: string = (params.success ? ((params.data as Record<string, unknown>).date as string | undefined) : undefined) ?? localToday;

  const patientId = params.success ? params.data.patientId : undefined;
  const consultationId = params.success ? params.data.consultationId : undefined;

  const all = await db.select().from(prescriptionsTable)
    .where(and(
      !consultationId && !patientId ? eq(prescriptionsTable.visitDate, date) : undefined,
      patientId      ? eq(prescriptionsTable.patientId,     patientId)     : undefined,
      consultationId ? eq(prescriptionsTable.consultationId, consultationId) : undefined,
    ))
    .orderBy(desc(prescriptionsTable.createdAt));
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
  const consultationRow = parsed.data.consultationId
    ? (await db.select({ visitDate: consultationsTable.visitDate }).from(consultationsTable).where(eq(consultationsTable.id, parsed.data.consultationId)))[0]
    : null;
  const visitDate = consultationRow?.visitDate ?? localDateStr();
  const [p] = await db.insert(prescriptionsTable).values({ ...parsed.data, visitDate }).returning();
  await logAudit(req, req.user!.id, "CREATE_PRESCRIPTION", "prescriptions", p.id);
  res.status(201).json(await formatPrescription(p));
});

router.post("/prescriptions/:id/translate", authenticate, async (req, res): Promise<void> => {
  const params = TranslatePrescriptionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = TranslatePrescriptionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [p] = await db.select().from(prescriptionsTable).where(eq(prescriptionsTable.id, params.data.id));
  if (!p) { res.status(404).json({ error: "Prescription not found" }); return; }

  const targetLang = parsed.data.language;
  const langName = LANGUAGE_NAMES[targetLang] ?? targetLang;

  // Build item dosage instructions to translate
  type PrescriptionItem = { drugName: string; genericName?: string | null; dosage: string; frequency: string; duration: string; instructions?: string | null; quantity?: number | null; };
  const items = (p.items as PrescriptionItem[]) ?? [];

  const fieldsToTranslate: Record<string, string> = {};
  if (p.advice) fieldsToTranslate.advice = p.advice;
  if (p.notes) fieldsToTranslate.notes = p.notes;
  items.forEach((item, i) => {
    if (item.dosage) fieldsToTranslate[`item_${i}_dosage`] = item.dosage;
    if (item.frequency) fieldsToTranslate[`item_${i}_frequency`] = item.frequency;
    if (item.duration) fieldsToTranslate[`item_${i}_duration`] = item.duration;
    if (item.instructions) fieldsToTranslate[`item_${i}_instructions`] = item.instructions;
  });

  const systemPrompt = `You are a medical prescription translator. Translate the given medical text from English to ${langName}.
Rules:
- Keep medicine/drug names exactly as written (do NOT translate brand or generic drug names)
- Translate dosage instructions, frequency, duration, and advice into natural patient-friendly ${langName}
- Use proper medical terminology appropriate for patient communication
- For Indic scripts, use native numerals where appropriate (e.g. ५ for 5 in Marathi/Hindi)
- Return ONLY a valid JSON object with the same keys, values translated. No commentary.`;

  const userPrompt = `Translate these prescription fields to ${langName}:\n${JSON.stringify(fieldsToTranslate, null, 2)}`;

  let translated: Record<string, string> = {};
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const jsonStr = raw.replace(/^```json\n?|\n?```$/g, "").trim();
    try {
      translated = JSON.parse(jsonStr) as Record<string, string>;
    } catch (parseErr) {
      req.log.error({ parseErr, raw }, "Translation JSON parse failed");
      res.status(502).json({ error: "Translation response was malformed. Please try again." });
      return;
    }
  } catch (err) {
    req.log.error({ err }, "Translation API call failed");
    res.status(502).json({ error: "Translation failed. Please try again." });
    return;
  }

  // Rebuild translated items (keep drug names, translate instructions)
  const translatedItems = items.map((item, i) => ({
    ...item,
    dosage: translated[`item_${i}_dosage`] ?? item.dosage,
    frequency: translated[`item_${i}_frequency`] ?? item.frequency,
    duration: translated[`item_${i}_duration`] ?? item.duration,
    instructions: translated[`item_${i}_instructions`] ?? item.instructions,
  }));

  const translations = {
    language: targetLang,
    languageName: langName,
    diagnosis: null,
    advice: translated.advice ?? null,
    notes: translated.notes ?? null,
    items: translatedItems,
  };

  const [updated] = await db.update(prescriptionsTable)
    .set({ patientLanguage: targetLang, translations })
    .where(eq(prescriptionsTable.id, params.data.id))
    .returning();

  await logAudit(req, req.user!.id, "TRANSLATE_PRESCRIPTION", "prescriptions", params.data.id);
  res.json(await formatPrescription(updated));
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
