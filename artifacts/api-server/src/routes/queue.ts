import { Router } from "express";
import { eq, and, desc, asc, isNotNull, sql } from "drizzle-orm";
import { db, queueTokensTable, patientsTable, usersTable, consultationsTable } from "@workspace/db";
import {
  GetQueueQueryParams,
  GenerateTokenBody,
  UpdateTokenStatusParams,
  UpdateTokenStatusBody,
  CallNextPatientBody,
} from "@workspace/api-zod";
import { authenticate } from "../middlewares/authenticate";
import { localDateStr } from "../lib/date";

const router = Router();

function deriveAge(dob?: string | null, ageText?: string | null): string | null {
  if (dob) {
    const birth = new Date(dob);
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--;
    return `${years}y`;
  }
  return ageText ?? null;
}

async function formatToken(t: typeof queueTokensTable.$inferSelect) {
  const [patient] = await db.select({
    salutation: patientsTable.salutation,
    fullName: patientsTable.fullName,
    phone: patientsTable.phone,
    dateOfBirth: patientsTable.dateOfBirth,
    age: patientsTable.age,
    gender: patientsTable.gender,
  }).from(patientsTable).where(eq(patientsTable.id, t.patientId));
  const [doctor] = await db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, t.doctorId));
  const [consultation] = await db.select({ id: consultationsTable.id }).from(consultationsTable).where(eq(consultationsTable.tokenId, t.id));
  return {
    id: t.id,
    tokenNumber: t.tokenNumber,
    patientId: t.patientId,
    patientName: [patient?.salutation, patient?.fullName].filter(Boolean).join(" ") || "",
    patientPhone: patient?.phone ?? null,
    patientAge: deriveAge(patient?.dateOfBirth, patient?.age),
    patientGender: patient?.gender ?? null,
    doctorId: t.doctorId,
    doctorName: doctor?.fullName ?? "",
    appointmentId: t.appointmentId ?? null,
    consultationId: consultation?.id ?? null,
    status: t.status,
    visitType: t.visitType,
    priority: t.priority,
    skippedCount: t.skippedCount,
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
  const today = localDateStr();
  const date = (params.success && params.data.date) ? params.data.date : today;
  const doctorId = params.success ? params.data.doctorId : undefined;
  const visitType = params.success ? (params.data as Record<string, unknown>).visitType as string | undefined : undefined;

  const whereClause = doctorId
    ? and(eq(queueTokensTable.queueDate, date), eq(queueTokensTable.doctorId, doctorId))
    : eq(queueTokensTable.queueDate, date);

  // Sort by sortOrder (respects skip re-insertion) then tokenNumber as tiebreak
  const tokens = await db.select().from(queueTokensTable)
    .where(whereClause)
    .orderBy(asc(queueTokensTable.sortOrder), asc(queueTokensTable.tokenNumber));
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
  let waitingIndex = 0;
  formatted.forEach(token => {
    if (token.status === "waiting") {
      token.estimatedWaitMinutes = rollingAvg * waitingIndex;
      waitingIndex++;
    } else {
      token.estimatedWaitMinutes = null;
    }
  });

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
  const today = parsed.data.date ?? localDateStr();
  const existing = await db.select().from(queueTokensTable)
    .where(and(eq(queueTokensTable.queueDate, today), eq(queueTokensTable.doctorId, parsed.data.doctorId)));
  const nextTokenNum = existing.length + 1;

  const [token] = await db.insert(queueTokensTable).values({
    tokenNumber: nextTokenNum,
    patientId: parsed.data.patientId,
    doctorId: parsed.data.doctorId,
    appointmentId: parsed.data.appointmentId,
    visitType: parsed.data.visitType ?? "new",
    priority: parsed.data.priority ?? 0,
    sortOrder: nextTokenNum * 1000,
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

  // ── Special case: skip → re-queue 3 positions later ──────────────────────
  if (parsed.data.status === "skipped") {
    const [current] = await db.select().from(queueTokensTable).where(eq(queueTokensTable.id, params.data.id));
    if (!current) {
      res.status(404).json({ error: "Token not found" });
      return;
    }

    // Fetch all waiting tokens for this doctor+date, ordered by current sortOrder
    const waitingTokens = await db.select({ id: queueTokensTable.id, sortOrder: queueTokensTable.sortOrder })
      .from(queueTokensTable)
      .where(and(
        eq(queueTokensTable.doctorId, current.doctorId),
        eq(queueTokensTable.queueDate, current.queueDate),
        eq(queueTokensTable.status, "waiting"),
      ))
      .orderBy(asc(queueTokensTable.sortOrder), asc(queueTokensTable.tokenNumber));

    const currIdx = waitingTokens.findIndex(t => t.id === params.data.id);

    // Compute new sortOrder: insert after 3 tokens ahead in the waiting list
    let newSortOrder: number;
    const afterIdx = currIdx + 3; // index in original list (including current token)

    if (currIdx < 0 || afterIdx >= waitingTokens.length) {
      // Fewer than 3 ahead — go to end
      const last = waitingTokens[waitingTokens.length - 1];
      newSortOrder = (last?.sortOrder ?? current.sortOrder) + 1000;
    } else {
      const afterToken  = waitingTokens[afterIdx];
      const nextToken   = waitingTokens[afterIdx + 1];
      if (nextToken) {
        newSortOrder = Math.floor((afterToken.sortOrder + nextToken.sortOrder) / 2);
        // Guard against sortOrder collision (e.g. repeated skips narrowing the gap)
        if (newSortOrder <= afterToken.sortOrder) newSortOrder = afterToken.sortOrder + 1;
      } else {
        newSortOrder = afterToken.sortOrder + 1000;
      }
    }

    const [token] = await db.update(queueTokensTable)
      .set({
        sortOrder: newSortOrder,
        skippedCount: sql`${queueTokensTable.skippedCount} + 1`,
      })
      .where(eq(queueTokensTable.id, params.data.id))
      .returning();

    if (!token) {
      res.status(404).json({ error: "Token not found" });
      return;
    }
    res.json(await formatToken(token));
    return;
  }

  // ── Normal status transitions ─────────────────────────────────────────────
  const updates: Partial<typeof queueTokensTable.$inferInsert> = { status: parsed.data.status };
  if (parsed.data.status === "in_consultation") {
    updates.consultationStartedAt = new Date();
  } else if (parsed.data.status === "completed") {
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
  const today = localDateStr();
  await db.update(queueTokensTable)
    .set({ status: "completed", consultationEndedAt: new Date() })
    .where(and(eq(queueTokensTable.doctorId, parsed.data.doctorId), eq(queueTokensTable.status, "in_consultation"), eq(queueTokensTable.queueDate, today)));

  // Pick the next waiting token respecting sortOrder
  const waiting = await db.select().from(queueTokensTable)
    .where(and(eq(queueTokensTable.doctorId, parsed.data.doctorId), eq(queueTokensTable.status, "waiting"), eq(queueTokensTable.queueDate, today)))
    .orderBy(desc(queueTokensTable.priority), asc(queueTokensTable.sortOrder), asc(queueTokensTable.tokenNumber))
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
