import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
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
  const [patient] = await db.select({ fullName: patientsTable.fullName, phone: patientsTable.phone }).from(patientsTable).where(eq(patientsTable.id, t.patientId));
  const [doctor] = await db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, t.doctorId));
  return {
    id: t.id,
    tokenNumber: t.tokenNumber,
    patientId: t.patientId,
    patientName: patient?.fullName ?? "",
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

const VISIT_DURATION: Record<string, number> = { new: 10, followup: 5 };
const ACTIVE_STATUSES = new Set(["waiting", "called", "in_consultation"]);

router.get("/queue", authenticate, async (req, res): Promise<void> => {
  const params = GetQueueQueryParams.safeParse(req.query);
  const today = new Date().toISOString().split("T")[0];
  const date = (params.success && params.data.date) ? params.data.date : today;
  const doctorId = params.success ? params.data.doctorId : undefined;
  const visitType = params.success ? (params.data as Record<string, unknown>).visitType as string | undefined : undefined;

  // Fetch ALL tokens (no visitType filter at DB level) so cumulative wait math is correct
  let query = db.select().from(queueTokensTable).where(eq(queueTokensTable.queueDate, date)).$dynamic();
  if (doctorId) query = query.where(eq(queueTokensTable.doctorId, doctorId));

  const tokens = await query.orderBy(queueTokensTable.tokenNumber);
  const formatted = await Promise.all(tokens.map(t => formatToken(t)));

  // Cumulative wait: for each "waiting" token, sum durations of all active tokens ahead
  formatted.forEach((token, i) => {
    if (token.status !== "waiting") {
      token.estimatedWaitMinutes = null;
      return;
    }
    let cumulativeWait = 0;
    for (let j = 0; j < i; j++) {
      const ahead = formatted[j];
      if (ACTIVE_STATUSES.has(ahead.status)) {
        cumulativeWait += VISIT_DURATION[ahead.visitType ?? "new"] ?? 10;
      }
    }
    token.estimatedWaitMinutes = cumulativeWait;
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
