import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, patientsTable, queueTokensTable, invoicesTable, consultationsTable, prescriptionsTable, certificatesTable, usersTable, chargeTypesTable } from "@workspace/db";
import { authenticate, requireRole } from "../middlewares/authenticate";

const router = Router();

router.get("/reports/daily-opd", authenticate, async (req, res): Promise<void> => {
  const date = req.query.date as string ?? new Date().toISOString().split("T")[0];
  const doctorId = req.query.doctorId as string | undefined;

  let tokenQuery = db.select().from(queueTokensTable).where(eq(queueTokensTable.queueDate, date)).$dynamic();
  if (doctorId) tokenQuery = tokenQuery.where(eq(queueTokensTable.doctorId, doctorId));
  const tokens = await tokenQuery;

  const totalPatients = tokens.length;
  const newPatients = await db.select({ count: sql<number>`count(*)` }).from(patientsTable).where(sql`date(created_at) = ${date}`);

  const doctors = await db.select().from(usersTable).where(and(eq(usersTable.role, "doctor"), eq(usersTable.isActive, true)));
  const byDoctor = await Promise.all(doctors.map(async (doc) => {
    const docTokens = tokens.filter(t => t.doctorId === doc.id);
    const docInvoices = await db.select({ total: sql<number>`coalesce(sum(total),0)` }).from(invoicesTable)
      .where(and(sql`date(created_at) = ${date}`, eq(invoicesTable.doctorId, doc.id)));
    return {
      doctorId: doc.id,
      doctorName: doc.fullName,
      patients: docTokens.length,
      revenue: Number(docInvoices[0]?.total ?? 0),
    };
  }));

  const invoiceRows = await db.select({ paymentMode: invoicesTable.paymentMode, total: invoicesTable.total })
    .from(invoicesTable).where(sql`date(created_at) = ${date}`);
  const totalRevenue = invoiceRows.reduce((s, r) => s + r.total, 0);

  const modeMap: Record<string, { amount: number; count: number }> = {};
  for (const r of invoiceRows) {
    const mode = r.paymentMode ?? "unknown";
    if (!modeMap[mode]) modeMap[mode] = { amount: 0, count: 0 };
    modeMap[mode].amount += r.total;
    modeMap[mode].count += 1;
  }
  const byPaymentMode = Object.entries(modeMap).map(([mode, v]) => ({ mode, ...v }));

  res.json({
    date,
    totalPatients,
    totalRevenue,
    newPatients: Number(newPatients[0]?.count ?? 0),
    followUps: totalPatients - Number(newPatients[0]?.count ?? 0),
    byDoctor: byDoctor.filter(d => d.patients > 0),
    byPaymentMode,
  });
});

router.get("/reports/revenue", authenticate, async (req, res): Promise<void> => {
  const startDate = req.query.startDate as string ?? new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const endDate = req.query.endDate as string ?? new Date().toISOString().split("T")[0];

  const invoices = await db.select().from(invoicesTable)
    .where(sql`date(created_at) between ${startDate} and ${endDate}`);

  const totalRevenue = invoices.reduce((s, i) => s + i.total, 0);
  const collected = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amountPaid, 0);
  const pending = invoices.filter(i => i.status === "pending" || i.status === "partial").reduce((s, i) => s + i.balance, 0);

  // Daily breakdown
  const dailyMap: Record<string, { revenue: number; count: number }> = {};
  for (const inv of invoices) {
    const d = inv.createdAt.toISOString().split("T")[0];
    if (!dailyMap[d]) dailyMap[d] = { revenue: 0, count: 0 };
    dailyMap[d].revenue += inv.total;
    dailyMap[d].count += 1;
  }
  const daily = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }));

  // Charge-type breakdown — parse JSONB items from each invoice
  const allChargeTypes = await db.select().from(chargeTypesTable);
  const ctMap: Record<string, { name: string; category: string }> = {};
  for (const ct of allChargeTypes) ctMap[ct.id] = { name: ct.name, category: ct.category };

  type BreakRow = { name: string; category: string; total: number; count: number };
  const byTypeMap: Record<string, BreakRow> = {};
  const byCatMap: Record<string, BreakRow> = {};

  for (const inv of invoices) {
    const items = (inv.items as unknown as { chargeTypeId?: string; description?: string; total?: number }[]) ?? [];
    for (const item of items) {
      const lineTotal = item.total ?? 0;
      const ct = item.chargeTypeId ? ctMap[item.chargeTypeId] : null;
      const typeName = ct?.name ?? item.description ?? "Other";
      const catName  = ct?.category ?? "other";

      if (!byTypeMap[typeName]) byTypeMap[typeName] = { name: typeName, category: catName, total: 0, count: 0 };
      byTypeMap[typeName].total += lineTotal;
      byTypeMap[typeName].count += 1;

      if (!byCatMap[catName]) byCatMap[catName] = { name: catName, category: catName, total: 0, count: 0 };
      byCatMap[catName].total += lineTotal;
      byCatMap[catName].count += 1;
    }
  }

  const byChargeType = Object.values(byTypeMap).sort((a, b) => b.total - a.total);
  const byCategory   = Object.values(byCatMap).sort((a, b) => b.total - a.total);

  res.json({ startDate, endDate, totalRevenue, totalInvoices: invoices.length, collected, pending, daily, byChargeType, byCategory });
});

router.get("/reports/doctor-productivity", authenticate, async (req, res): Promise<void> => {
  const startDate = req.query.startDate as string ?? new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const endDate = req.query.endDate as string ?? new Date().toISOString().split("T")[0];
  const filterDoctorId = req.query.doctorId as string | undefined;

  let doctorsQuery = db.select().from(usersTable).where(and(eq(usersTable.role, "doctor"), eq(usersTable.isActive, true))).$dynamic();
  if (filterDoctorId) doctorsQuery = doctorsQuery.where(eq(usersTable.id, filterDoctorId));
  const doctors = await doctorsQuery;

  const daysDiff = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000));

  const rows = await Promise.all(doctors.map(async (doc) => {
    const consultations = await db.select().from(consultationsTable)
      .where(and(eq(consultationsTable.doctorId, doc.id), sql`visit_date between ${startDate} and ${endDate}`));
    const invoices = await db.select({ total: sql<number>`coalesce(sum(total),0)` }).from(invoicesTable)
      .where(and(eq(invoicesTable.doctorId, doc.id), sql`date(created_at) between ${startDate} and ${endDate}`));
    const prescriptions = await db.select({ count: sql<number>`count(*)` }).from(prescriptionsTable)
      .where(and(eq(prescriptionsTable.doctorId, doc.id), sql`visit_date between ${startDate} and ${endDate}`));
    const certs = await db.select({ count: sql<number>`count(*)` }).from(certificatesTable)
      .where(and(eq(certificatesTable.doctorId, doc.id), sql`date(created_at) between ${startDate} and ${endDate}`));

    return {
      doctorId: doc.id,
      doctorName: doc.fullName,
      totalPatients: consultations.length,
      totalRevenue: Number(invoices[0]?.total ?? 0),
      avgPerDay: Math.round(consultations.length / daysDiff * 10) / 10,
      prescriptions: Number(prescriptions[0]?.count ?? 0),
      certificates: Number(certs[0]?.count ?? 0),
    };
  }));

  res.json({ startDate, endDate, doctors: rows });
});

export default router;
