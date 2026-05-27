import { Router } from "express";
import { db, clinicSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/authenticate";

const router = Router();

function formatSettings(s: typeof clinicSettingsTable.$inferSelect) {
  return {
    id: s.id,
    clinicName: s.clinicName,
    address: s.address ?? null,
    phone: s.phone ?? null,
    email: s.email ?? null,
    website: s.website ?? null,
    registrationNumber: s.registrationNumber ?? null,
    taxId: s.taxId ?? null,
    currency: s.currency,
    timezone: s.timezone,
    sessionTimeoutMinutes: s.sessionTimeoutMinutes,
    defaultConsultationFee: s.defaultConsultationFee ?? null,
    logoUrl: s.logoUrl ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

router.get("/settings/clinic", authenticate, async (req, res): Promise<void> => {
  const [settings] = await db.select().from(clinicSettingsTable).limit(1);
  if (!settings) {
    // Auto-create default settings
    const [created] = await db.insert(clinicSettingsTable).values({ clinicName: "My Clinic" }).returning();
    res.json(formatSettings(created));
    return;
  }
  res.json(formatSettings(settings));
});

router.patch("/settings/clinic", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const {
    clinicName, address, phone, email, website,
    registrationNumber, taxId, currency, timezone,
    sessionTimeoutMinutes, defaultConsultationFee, logoUrl,
  } = req.body as Partial<typeof clinicSettingsTable.$inferInsert>;

  const patch = Object.fromEntries(
    Object.entries({
      clinicName, address, phone, email, website,
      registrationNumber, taxId, currency, timezone,
      sessionTimeoutMinutes, defaultConsultationFee, logoUrl,
    }).filter(([, v]) => v !== undefined),
  );

  const [existing] = await db.select().from(clinicSettingsTable).limit(1);
  if (!existing) {
    const [created] = await db
      .insert(clinicSettingsTable)
      .values({ clinicName: "My Clinic", ...patch })
      .returning();
    res.json(formatSettings(created));
    return;
  }
  const [updated] = await db
    .update(clinicSettingsTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(clinicSettingsTable.id, existing.id))
    .returning();
  res.json(formatSettings(updated));
});

export default router;
