import { Router } from "express";
import { eq, and, desc, asc, isNotNull, inArray, sql } from "drizzle-orm";
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
import { averageMinutes, estimateDoctorQueue, runningSeconds } from "../lib/consultationTiming";
import { lockDoctor, transitionQueueToken, updateQueueTokenStatus, QueueTransitionError } from "../lib/queueTransitions";

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
    patientId: patientsTable.patientId,
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
    patientNumber: patient?.patientId ?? null,
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
    activeStartedAt: t.activeStartedAt?.toISOString() ?? null,
    activeAccumulatedSeconds: t.activeSeconds,
    activeConsultationSeconds: t.activeSeconds === null ? null : t.activeSeconds + runningSeconds(t, new Date()),
    elapsedConsultationMinutes: t.consultationStartedAt
      ? Math.max(0, Math.round(((t.consultationEndedAt ?? new Date()).getTime() - t.consultationStartedAt.getTime()) / 60000)) : null,
    sessionCount: t.sessionCount,
  };
}

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
        inArray(queueTokensTable.status, ["consultation_done", "completed"]),
        isNotNull(queueTokensTable.consultationStartedAt),
        isNotNull(queueTokensTable.consultationEndedAt),
      )
    : and(
        eq(queueTokensTable.queueDate, date),
        inArray(queueTokensTable.status, ["consultation_done", "completed"]),
        isNotNull(queueTokensTable.consultationStartedAt),
        isNotNull(queueTokensTable.consultationEndedAt),
      );

  const recentCompleted = await db.select().from(queueTokensTable)
    .where(and(completedWhereClause, isNotNull(queueTokensTable.activeSeconds)))
    .orderBy(desc(queueTokensTable.consultationEndedAt))
    .limit(10);

  const avgConsultationDuration = averageMinutes(recentCompleted.map(t => t.activeSeconds!));
  const elapsedCompleted = await db.select().from(queueTokensTable).where(completedWhereClause)
    .orderBy(desc(queueTokensTable.consultationEndedAt)).limit(10);
  const avgElapsedConsultationDuration = averageMinutes(elapsedCompleted.map(t =>
    Math.max(0, (t.consultationEndedAt!.getTime() - t.consultationStartedAt!.getTime()) / 1000)));

  // Estimates follow the same review-first ordering as Call Next, independently per doctor.
  // Investigation waits are excluded until staff marks the patient ready for review.
  const now = new Date();
  for (const currentDoctor of new Set(tokens.map(t => t.doctorId))) {
    const samples = await db.select().from(queueTokensTable).where(and(
      eq(queueTokensTable.doctorId, currentDoctor), eq(queueTokensTable.queueDate, date),
      inArray(queueTokensTable.status, ["consultation_done", "completed"]),
      isNotNull(queueTokensTable.activeSeconds), isNotNull(queueTokensTable.consultationEndedAt),
    )).orderBy(desc(queueTokensTable.consultationEndedAt)).limit(10);
    for (const estimate of estimateDoctorQueue(tokens.filter(t => t.doctorId === currentDoctor), samples, now)) {
      formatted.find(token => token.id === estimate.id)!.estimatedWaitMinutes = estimate.estimatedWaitMinutes;
    }
  }

  const result = visitType ? formatted.filter(t => t.visitType === visitType) : formatted;
  const waiting = formatted.filter(t => t.status === "waiting" || t.status === "ready_for_review");
  const inProgress = formatted.find(t => t.status === "in_consultation") ?? formatted.find(t => t.status === "called");

  const totalWaitMins = waiting.reduce((sum, t) => sum + (t.estimatedWaitMinutes ?? 0), 0);
  const avgWait = waiting.length > 0 ? Math.round(totalWaitMins / waiting.length) : 0;

  res.json({
    tokens: result,
    totalWaiting: waiting.length,
    currentlyServing: inProgress?.tokenNumber ?? null,
    averageWaitMinutes: avgWait,
    avgConsultationDuration,
    avgElapsedConsultationDuration,
    returningReady: formatted.filter(t => t.status === "ready_for_review").length,
    awaitingInvestigations: formatted.filter(t => t.status === "awaiting_investigations").length,
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
    if (current.status !== "waiting") {
      res.status(409).json({ error: "Only waiting patients can be skipped" });
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
  let token;
  try {
    token = await updateQueueTokenStatus(params.data.id, parsed.data.status);
  } catch (error) {
    if (!(error instanceof QueueTransitionError)) throw error;
    res.status(409).json({ error: error.message });
    return;
  }
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
  const today = parsed.data.date ?? localDateStr();
  const token = await db.transaction(async tx => {
    await lockDoctor(tx, parsed.data.doctorId);
    const [next] = await tx.select().from(queueTokensTable)
      .where(and(eq(queueTokensTable.doctorId, parsed.data.doctorId),
        inArray(queueTokensTable.status, ["waiting", "ready_for_review"]), eq(queueTokensTable.queueDate, today)))
      .orderBy(desc(queueTokensTable.priority),
        sql`case when ${queueTokensTable.status} = 'ready_for_review' then 0 else 1 end`,
        asc(queueTokensTable.sortOrder), asc(queueTokensTable.tokenNumber))
      .limit(1);
    if (!next) return undefined;
    // Neither first nor review sessions start until the doctor presses Start/Resume.
    return transitionQueueToken(tx, next.id, "called");
  });
  if (!token) {
    res.status(404).json({ error: "No patients waiting" });
    return;
  }

  res.json(await formatToken(token));
});

export default router;
