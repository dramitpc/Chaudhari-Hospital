import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, patientsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { logAudit } from "../lib/auth";

const router = Router();

const ABDM_GATEWAY_URL = "https://dev.abdm.gov.in/gateway/v0.5/sessions";
const ABDM_HEALTH_ID_URL = "https://healthidsbx.abdm.gov.in/api/v2";

async function getGatewayToken(): Promise<string> {
  const clientId = process.env["ABDM_CLIENT_ID"];
  const clientSecret = process.env["ABDM_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new Error("ABDM_CLIENT_ID and ABDM_CLIENT_SECRET are not configured. Register at https://sandbox.abdm.gov.in to obtain credentials.");
  }
  const res = await fetch(ABDM_GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret, grantType: "client_credentials" }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`ABDM gateway auth failed (${res.status}): ${text}`);
  }
  const data = await res.json() as { accessToken: string };
  return data.accessToken;
}

function abdmHeaders(token: string): Record<string, string> {
  return { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };
}

function formatPatient(p: typeof patientsTable.$inferSelect) {
  return {
    id: p.id,
    patientId: p.patientId,
    salutation: p.salutation ?? null,
    fullName: p.fullName,
    dateOfBirth: p.dateOfBirth ?? null,
    age: p.age ?? null,
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
    abhaId: p.abhaId ?? null,
    abhaAddress: p.abhaAddress ?? null,
    abhaLinkedAt: p.abhaLinkedAt?.toISOString() ?? null,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

// POST /abdm/generate-otp
router.post("/abdm/generate-otp", authenticate, async (req, res): Promise<void> => {
  const { mobile } = req.body as { mobile?: string };
  if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
    res.status(400).json({ error: "A valid 10-digit Indian mobile number is required" });
    return;
  }
  try {
    const token = await getGatewayToken();
    const abdmRes = await fetch(`${ABDM_HEALTH_ID_URL}/registration/mobile/login/generateOtp`, {
      method: "POST",
      headers: abdmHeaders(token),
      body: JSON.stringify({ mobile, txnId: "" }),
    });
    if (!abdmRes.ok) {
      const text = await abdmRes.text().catch(() => abdmRes.statusText);
      req.log.error({ status: abdmRes.status, body: text }, "ABDM generate-otp failed");
      res.status(502).json({ error: `ABDM error (${abdmRes.status}): ${text}` });
      return;
    }
    const data = await abdmRes.json() as { txnId: string };
    res.json({ txnId: data.txnId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ABDM service error";
    req.log.error({ err }, "ABDM generate-otp exception");
    res.status(502).json({ error: msg });
  }
});

// POST /abdm/verify-otp
router.post("/abdm/verify-otp", authenticate, async (req, res): Promise<void> => {
  const { txnId, otp } = req.body as { txnId?: string; otp?: string };
  if (!txnId || !otp) {
    res.status(400).json({ error: "txnId and otp are required" });
    return;
  }
  try {
    const token = await getGatewayToken();

    const verifyRes = await fetch(`${ABDM_HEALTH_ID_URL}/registration/mobile/login/verifyOtp`, {
      method: "POST",
      headers: abdmHeaders(token),
      body: JSON.stringify({ otp, txnId }),
    });
    if (!verifyRes.ok) {
      const text = await verifyRes.text().catch(() => verifyRes.statusText);
      req.log.error({ status: verifyRes.status, body: text }, "ABDM verify-otp failed");
      res.status(502).json({ error: `ABDM error (${verifyRes.status}): ${text}` });
      return;
    }
    type RawProfile = { healthIdNumber: string; healthId: string; name: string; gender?: string; yearOfBirth?: string; mobile?: string };
    const verifyData = await verifyRes.json() as { txnId: string; mobileLinkedHid?: RawProfile[] };

    let profiles: RawProfile[] = [];

    const profileRes = await fetch(`${ABDM_HEALTH_ID_URL}/registration/mobile/login/userAuthorizedToken`, {
      method: "POST",
      headers: abdmHeaders(token),
      body: JSON.stringify({ txnId: verifyData.txnId }),
    });
    if (profileRes.ok) {
      const profileData = await profileRes.json() as { accounts?: RawProfile[]; mappedHid?: RawProfile[] };
      profiles = profileData.accounts ?? profileData.mappedHid ?? [];
    } else if (Array.isArray(verifyData.mobileLinkedHid)) {
      profiles = verifyData.mobileLinkedHid;
    }

    res.json({
      txnId: verifyData.txnId,
      profiles: profiles.map(p => ({
        abhaNumber: p.healthIdNumber,
        abhaAddress: p.healthId,
        name: p.name,
        gender: p.gender ?? null,
        yearOfBirth: p.yearOfBirth ?? null,
        mobile: p.mobile ?? null,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ABDM service error";
    req.log.error({ err }, "ABDM verify-otp exception");
    res.status(502).json({ error: msg });
  }
});

// POST /abdm/link/:patientId
router.post("/abdm/link/:patientId", authenticate, async (req, res): Promise<void> => {
  const patientId = (req.params as { patientId: string }).patientId;
  const { abhaNumber, abhaAddress } = req.body as { abhaNumber?: string; abhaAddress?: string };
  if (!abhaNumber || !abhaAddress) {
    res.status(400).json({ error: "abhaNumber and abhaAddress are required" });
    return;
  }
  try {
    const [updated] = await db
      .update(patientsTable)
      .set({ abhaId: abhaNumber, abhaAddress, abhaLinkedAt: new Date(), updatedAt: new Date() })
      .where(eq(patientsTable.id, patientId))
      .returning();
    if (!updated) { res.status(404).json({ error: "Patient not found" }); return; }
    logAudit(req, req.user!.id, "ABHA_LINK", "patient", patientId);
    res.json(formatPatient(updated));
  } catch (err) {
    req.log.error({ err }, "ABDM link exception");
    res.status(500).json({ error: "Failed to link ABHA" });
  }
});

// DELETE /abdm/link/:patientId
router.delete("/abdm/link/:patientId", authenticate, async (req, res): Promise<void> => {
  const patientId = (req.params as { patientId: string }).patientId;
  try {
    const [updated] = await db
      .update(patientsTable)
      .set({ abhaId: null, abhaAddress: null, abhaLinkedAt: null, updatedAt: new Date() })
      .where(eq(patientsTable.id, patientId))
      .returning();
    if (!updated) { res.status(404).json({ error: "Patient not found" }); return; }
    logAudit(req, req.user!.id, "ABHA_UNLINK", "patient", patientId);
    res.json(formatPatient(updated));
  } catch (err) {
    req.log.error({ err }, "ABDM unlink exception");
    res.status(500).json({ error: "Failed to unlink ABHA" });
  }
});

export default router;
