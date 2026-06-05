import { Router } from "express";
import { eq, and, desc, isNotNull } from "drizzle-orm";
import { db, queueTokensTable, patientsTable, usersTable } from "@workspace/db";
import {
  GetQueueQueryParams,
  GenerateTokenBody,
  UpdateTokenStatusParams,
  UpdateTokenStatusBody,
  CallNextPatientBody,
} from "@workspace/api-zod";
import { authenticate } from "../middlewares/authenticate";

const router = Router();

async function formatToken(t: typeof queueTokensTable.$inferSelect) {
  const [patient] = await db.select({ salutation: patientsTable.salutation, fullName: patientsTable.fullName, phone: patientsTable.phone }).from(patientsTable).where(eq(patientsTable.id, t.patientId));
  const [doctor] = await db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, t.doctorId));
  return {
    id: t.id,
    tokenNumber: t.tokenNumber,
    patientId: t.patientId,
    patientName: [patient?.salutation, patient?.fullName].filter(Boolean).join(" ") || "",
    patientPhone: patient?.phone ?? null,
    doctorId: t.doctorId,
    doctorName: doctor?.fullName ?? "",
    appointmentId: t.appointmentId ?? null,
    status: t.status,
    visitType: t.visitType,
    priority: t.priority,
    estimatedWaitMinutes: null as number | null,
    queueDate: t.queueDate,
    createdAt: t.createdAt.toISOString(),
    consultationStartedAt: t.consultationStartedAt?.toISOString() ?? null,
    consultationEndedAt: t.consultationEndedAt?.toISOString() ?? null,
  };
}

const FALLBACK_DURATION = 8; // minutes, used when no completed consultations yet

router.get("/queue", authenticate, async (req, res): Promise<void> => {
  const params = GetQueueQueryParams.safeParse(req.query);
  const today = new Date().toISOString().split("T")[0];
  const date = (params.success && params.data.date) ? params.data.date : today;
  const doctorId = params.success ? params.data.doctorId : undefined;
  const visitType = params.success ? (params.data as Record<string, unknown>).visitType as string | undefined : undefined;

  // Fetch ALL tokens (no visitType filter at DB level) so wait math is correct
  const whereClause = doctorId
    ? and(eq(queueTokensTable.queueDate, date), eq(queueTokensTable.doctorId, doctorId))
    : eq(queueTokensTable.queueDate, date);

  const tokens = await db.select().from(queueTokensTable)
    .where(whereClause)
    .orderBy(queueTokensTable.tokenNumber);
  const formatted = await Promise.all(tokens.map(t => formatToken(t)));

  // ── Rolling average of last 10 completed consultation durations ───────────
  const completedWhereClause = doctorId
    ? and(
        eq(queueTokensTable.queueDate, date),
        eq(queueTokensTable.doctorId, doctorId),
        eq(queueTokensTable.status, "completed"),
        isNotNull(queueTokensTable.consultationStartedAt),
        isNotNull(queueTokensTable.consultationEndedAt),
      )
    : and(
        eq(queueTokensTable.queueDate, date),
        eq(queueTokensTable.status, "completed"),
        isNotNull(queueTokensTable.consultationStartedAt),
        isNotNull(queueTokensTable.consultationEndedAt),
      );

  const recentCompleted = await db.select({
    consultationStartedAt: queueTokensTable.consultationStartedAt,
    consultationEndedAt: queueTokensTable.consultationEndedAt,
  }).from(queueTokensTable)
    .where(completedWhereClause)
    .orderBy(desc(queueTokensTable.updatedAt))
    .limit(10);

  const durations = recentCompleted
    .filter(t => t.consultationStartedAt && t.consultationEndedAt)
    .map(t => (t.consultationEndedAt!.getTime() - t.consultationStartedAt!.getTime()) / 60000);

  const avgConsultationDuration = durations.length > 0
    ? Math.max(1, Math.round(durations.reduce((a, b) => a + b, 0) / durations.length))
    : null;

  const rollingAvg = avgConsultationDuration ?? FALLBACK_DURATION;

  // ── Assign estimated wait using: rollingAvg × (waitingPosition - 1) ───────
  // Position 1 (first in waiting) = 0 min, Position 2 = 1×avg, etc.
  let waitingIndex = 0;
  formatted.forEach(token => {
    if (token.status === "waiting") {
      token.estimatedWaitMinutes = rollingAvg * waitingIndex;
      waitingIndex++;
    } else {
      token.estimatedWaitMinutes = null;
    }
  });

  // Apply visitType filter after computing waits
  const result = visitType ? formatted.filter(t => t.visitType === visitType) : formatted;
  const waiting = formatted.filter(t => t.status === "waiting");
  const inProgress = formatted.find(t => t.status === "in_consultation" || t.status === "called");

  const totalWaitMins = waiting.reduce((sum, t) => sum + (t.estimatedWaitMinutes ?? 0), 0);
  const avgWait = waiting.length > 0 ? Math.round(totalWaitMins / waiting.length) : 0;

  res.json({
    tokens: result,
    totalWaiting: waiting.length,
    currentlyServing: inProgress?.tokenNumber ?? null,
    averageWaitMinutes: avgWait,
    avgConsultationDuration,
  });
});

router.post("/queue/tokens", authenticate, async (req, res): Promise<void> => {
  const parsed = GenerateTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const today = parsed.data.date ?? new Date().toISOString().split("T")[0];
  const existing = await db.select().from(queueTokensTable)
    .where(and(eq(queueTokensTable.queueDate, today), eq(queueTokensTable.doctorId, parsed.data.doctorId)));
  const nextToken = existing.length + 1;

  const [token] = await db.insert(queueTokensTable).values({
    tokenNumber: nextToken,
    patientId: parsed.data.patientId,
    doctorId: parsed.data.doctorId,
    appointmentId: parsed.data.appointmentId,
    visitType: parsed.data.visitType ?? "new",
    priority: parsed.data.priority ?? 0,
    queueDate: today,
    status: "waiting",
  }).returning();

  res.status(201).json(await formatToken(token));
});

router.patch("/queue/tokens/:id/status", authenticate, async (req, res): Promise<void> => {
  const params = UpdateTokenStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateTokenStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates: Partial<typeof queueTokensTable.$inferInsert> = { status: parsed.data.status };
  if (parsed.data.status === "in_consultation") {
    updates.consultationStartedAt = new Date();
  } else if (parsed.data.status === "completed" || parsed.data.status === "skipped") {
    updates.consultationEndedAt = new Date();
  }
  const [token] = await db.update(queueTokensTable).set(updates).where(eq(queueTokensTable.id, params.data.id)).returning();
  if (!token) {
    res.status(404).json({ error: "Token not found" });
    return;
  }
  res.json(await formatToken(token));
});

router.post("/queue/next", authenticate, async (req, res): Promise<void> => {
  const parsed = CallNextPatientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const today = new Date().toISOString().split("T")[0];
  await db.update(queueTokensTable)
    .set({ status: "completed", consultationEndedAt: new Date() })
    .where(and(eq(queueTokensTable.doctorId, parsed.data.doctorId), eq(queueTokensTable.status, "in_consultation"), eq(queueTokensTable.queueDate, today)));

  const waiting = await db.select().from(queueTokensTable)
    .where(and(eq(queueTokensTable.doctorId, parsed.data.doctorId), eq(queueTokensTable.status, "waiting"), eq(queueTokensTable.queueDate, today)))
    .orderBy(desc(queueTokensTable.priority), queueTokensTable.tokenNumber)
    .limit(1);

  if (!waiting.length) {
    res.status(404).json({ error: "No patients waiting" });
    return;
  }

  const [token] = await db.update(queueTokensTable)
    .set({ status: "called", consultationStartedAt: new Date() })
    .where(eq(queueTokensTable.id, waiting[0].id))
    .returning();

  res.json(await formatToken(token));
});

export default router;
