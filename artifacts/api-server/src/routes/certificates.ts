import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, certificatesTable, patientsTable, usersTable } from "@workspace/db";
import {
  ListCertificatesQueryParams,
  CreateCertificateBody,
  GetCertificateParams,
} from "@workspace/api-zod";
import { authenticate } from "../middlewares/authenticate";
import { logAudit } from "../lib/auth";

const router = Router();

async function formatCertificate(c: typeof certificatesTable.$inferSelect) {
  const [patient] = await db.select({ fullName: patientsTable.fullName }).from(patientsTable).where(eq(patientsTable.id, c.patientId));
  const [doctor] = await db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, c.doctorId));
  return {
    id: c.id,
    patientId: c.patientId,
    patientName: patient?.fullName ?? "",
    doctorId: c.doctorId,
    doctorName: doctor?.fullName ?? "",
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

  let query = db.select().from(certificatesTable).$dynamic();
  if (params.success && params.data.patientId) query = query.where(eq(certificatesTable.patientId, params.data.patientId));
  if (params.success && params.data.type) query = query.where(eq(certificatesTable.type, params.data.type as typeof certificatesTable.$inferSelect["type"]));

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

export default router;
