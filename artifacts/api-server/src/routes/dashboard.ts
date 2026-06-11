import { Router } from "express";
import { eq, desc, gte, lt, and, sql } from "drizzle-orm";
import {
  db,
  patientsTable,
  queueTokensTable,
  invoicesTable,
  consultationsTable,
  appointmentsTable,
  usersTable,
} from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { localDateStr, dayBounds } from "../lib/date";

const router = Router();

router.get("/dashboard/summary", authenticate, async (req, res): Promise<void> => {
  const today = (req.query.date as string | undefined) || localDateStr();
  const monthStart = `${today.slice(0, 7)}-01`;
  const [todayStart, todayEnd] = dayBounds(today);
  const [monthStartDate] = dayBounds(monthStart);

  const [
    totalPatientsResult,
    todayTokensResult,
    pendingQueueResult,
    todayInvoicesResult,
    todayAppointmentsResult,
    todayConsultationsResult,
    pendingBillingResult,
    newPatientsMonthResult,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(patientsTable),
    db.select({ count: sql<number>`count(*)` }).from(queueTokensTable).where(eq(queueTokensTable.queueDate, today)),
    db.select({ count: sql<number>`count(*)` }).from(queueTokensTable).where(and(eq(queueTokensTable.queueDate, today), eq(queueTokensTable.status, "waiting"))),
    db.select({ total: sql<number>`coalesce(sum(amount_paid), 0)` }).from(invoicesTable).where(and(gte(invoicesTable.createdAt, todayStart), lt(invoicesTable.createdAt, todayEnd))),
    db.select({ count: sql<number>`count(*)` }).from(appointmentsTable).where(eq(appointmentsTable.appointmentDate, today)),
    db.select({ count: sql<number>`count(*)` }).from(consultationsTable).where(and(eq(consultationsTable.visitDate, today), eq(consultationsTable.status, "completed"))),
    db.select({ count: sql<number>`count(*)` }).from(invoicesTable).where(eq(invoicesTable.status, "pending")),
    db.select({ count: sql<number>`count(*)` }).from(patientsTable).where(gte(patientsTable.createdAt, monthStartDate)),
  ]);

  res.json({
    todayPatients: Number(todayTokensResult[0]?.count ?? 0),
    todayRevenue: Number(todayInvoicesResult[0]?.total ?? 0),
    pendingQueue: Number(pendingQueueResult[0]?.count ?? 0),
    totalPatients: Number(totalPatientsResult[0]?.count ?? 0),
    todayAppointments: Number(todayAppointmentsResult[0]?.count ?? 0),
    completedConsultations: Number(todayConsultationsResult[0]?.count ?? 0),
    pendingBilling: Number(pendingBillingResult[0]?.count ?? 0),
    newPatientsThisMonth: Number(newPatientsMonthResult[0]?.count ?? 0),
    today,
  });
});

router.get("/dashboard/queue-status", authenticate, async (req, res): Promise<void> => {
  const today = localDateStr();
  const doctors = await db.select().from(usersTable).where(and(eq(usersTable.role, "doctor"), eq(usersTable.isActive, true)));

  const statuses = await Promise.all(doctors.map(async (doc) => {
    const tokens = await db.select().from(queueTokensTable)
      .where(and(eq(queueTokensTable.doctorId, doc.id), eq(queueTokensTable.queueDate, today)));

    const waiting = tokens.filter(t => t.status === "waiting").length;
    const inProgress = tokens.find(t => t.status === "in_consultation" || t.status === "called");
    const completed = tokens.filter(t => t.status === "completed").length;

    let currentPatientName: string | null = null;
    if (inProgress) {
      const [p] = await db.select({ fullName: patientsTable.fullName }).from(patientsTable).where(eq(patientsTable.id, inProgress.patientId));
      currentPatientName = p?.fullName ?? null;
    }

    return {
      doctorId: doc.id,
      doctorName: doc.fullName,
      specialization: doc.specialization ?? null,
      waiting,
      inProgress: inProgress ? 1 : 0,
      completed,
      currentToken: inProgress?.tokenNumber ?? null,
      currentPatientName,
    };
  }));

  res.json(statuses);
});

router.get("/dashboard/revenue-chart", authenticate, async (req, res): Promise<void> => {
  const days = req.query.days ? Number(req.query.days) : 30;
  const points = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = localDateStr(d);
    const [dayStart, dayEnd] = dayBounds(dateStr);
    const result = await db.select({
      total: sql<number>`coalesce(sum(total), 0)`,
      count: sql<number>`count(*)`,
    }).from(invoicesTable).where(and(gte(invoicesTable.createdAt, dayStart), lt(invoicesTable.createdAt, dayEnd)));
    points.push({ date: dateStr, revenue: Number(result[0]?.total ?? 0), count: Number(result[0]?.count ?? 0) });
  }
  res.json(points);
});

router.get("/dashboard/patient-trends", authenticate, async (req, res): Promise<void> => {
  const days = req.query.days ? Number(req.query.days) : 30;
  const points = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = localDateStr(d);
    const [dayStart, dayEnd] = dayBounds(dateStr);
    const total = await db.select({ count: sql<number>`count(*)` }).from(queueTokensTable).where(eq(queueTokensTable.queueDate, dateStr));
    const newP = await db.select({ count: sql<number>`count(*)` }).from(patientsTable).where(and(gte(patientsTable.createdAt, dayStart), lt(patientsTable.createdAt, dayEnd)));
    points.push({ date: dateStr, count: Number(total[0]?.count ?? 0), newPatients: Number(newP[0]?.count ?? 0) });
  }
  res.json(points);
});

export default router;
