import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, certificatesTable, patientsTable, usersTable } from "@workspace/db";
import {
  ListCertificatesQueryParams,
  CreateCertificateBody,
  GetCertificateParams,
  UpdateCertificateBody,
} from "@workspace/api-zod";
import { authenticate } from "../middlewares/authenticate";
import { logAudit } from "../lib/auth";

const router = Router();

async function formatCertificate(c: typeof certificatesTable.$inferSelect) {
  const [patient] = await db.select({ salutation: patientsTable.salutation, fullName: patientsTable.fullName }).from(patientsTable).where(eq(patientsTable.id, c.patientId));
  const [doctor] = await db.select({ fullName: usersTable.fullName, signatureData: usersTable.signatureData }).from(usersTable).where(eq(usersTable.id, c.doctorId));
  return {
    id: c.id,
    patientId: c.patientId,
    patientName: [patient?.salutation, patient?.fullName].filter(Boolean).join(" ") || "",
    doctorId: c.doctorId,
    doctorName: doctor?.fullName ?? "",
    doctorSignatureData: doctor?.signatureData ?? null,
    consultationId: c.consultationId ?? null,
    type: c.type,
    issuedDate: c.issuedDate,
    fromDate: c.fromDate ?? null,
    toDate: c.toDate ?? null,
    diagnosis: c.diagnosis ?? null,
    content: c.content ?? null,
    qrCode: c.qrCode ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/certificates", authenticate, async (req, res): Promise<void> => {
  const params = ListCertificatesQueryParams.safeParse(req.query);
  const page = params.success && params.data.page ? Number(params.data.page) : 1;
  const limit = params.success && params.data.limit ? Number(params.data.limit) : 20;

  const dateStr = params.success && params.data.date ? params.data.date : new Date().toLocaleDateString("en-CA");

  const conditions = [
    eq(certificatesTable.issuedDate, dateStr),
  ];
  if (params.success && params.data.patientId) conditions.push(eq(certificatesTable.patientId, params.data.patientId) as never);
  if (params.success && params.data.type) conditions.push(eq(certificatesTable.type, params.data.type as typeof certificatesTable.$inferSelect["type"]) as never);

  let query = db.select().from(certificatesTable).where(and(...conditions)).$dynamic();
  const all = await query.orderBy(desc(certificatesTable.issuedDate));
  const total = all.length;
  const slice = all.slice((page - 1) * limit, page * limit);
  const data = await Promise.all(slice.map(formatCertificate));
  res.json({ data, total, page, limit });
});

router.post("/certificates", authenticate, async (req, res): Promise<void> => {
  const parsed = CreateCertificateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // Generate QR code text for verification
  const qrCode = `HMS-CERT-${Date.now()}`;
  const [cert] = await db.insert(certificatesTable).values({ ...parsed.data, qrCode } as typeof certificatesTable.$inferInsert).returning();
  await logAudit(req, req.user!.id, "CREATE_CERTIFICATE", "certificates", cert.id, `Type: ${cert.type}`);
  res.status(201).json(await formatCertificate(cert));
});

router.get("/certificates/:id", authenticate, async (req, res): Promise<void> => {
  const params = GetCertificateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [cert] = await db.select().from(certificatesTable).where(eq(certificatesTable.id, params.data.id));
  if (!cert) {
    res.status(404).json({ error: "Certificate not found" });
    return;
  }
  await logAudit(req, req.user!.id, "VIEW_CERTIFICATE", "certificates", cert.id);
  res.json(await formatCertificate(cert));
});

router.put("/certificates/:id", authenticate, async (req, res): Promise<void> => {
  const params = GetCertificateParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateCertificateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(certificatesTable).where(eq(certificatesTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Certificate not found" }); return; }
  const [updated] = await db.update(certificatesTable)
    .set(parsed.data as Partial<typeof certificatesTable.$inferInsert>)
    .where(eq(certificatesTable.id, params.data.id))
    .returning();
  await logAudit(req, req.user!.id, "UPDATE_CERTIFICATE", "certificates", updated.id);
  res.json(await formatCertificate(updated));
});

router.delete("/certificates/:id", authenticate, async (req, res): Promise<void> => {
  const params = GetCertificateParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [existing] = await db.select().from(certificatesTable).where(eq(certificatesTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Certificate not found" }); return; }
  await db.delete(certificatesTable).where(eq(certificatesTable.id, params.data.id));
  await logAudit(req, req.user!.id, "DELETE_CERTIFICATE", "certificates", params.data.id);
  res.status(204).send();
});

export default router;
