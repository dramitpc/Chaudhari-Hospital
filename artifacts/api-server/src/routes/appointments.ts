import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, appointmentsTable, patientsTable, usersTable } from "@workspace/db";
import {
  ListAppointmentsQueryParams,
  CreateAppointmentBody,
  GetAppointmentParams,
  UpdateAppointmentParams,
  UpdateAppointmentBody,
  CancelAppointmentParams,
} from "@workspace/api-zod";
import { authenticate } from "../middlewares/authenticate";
import { logAudit } from "../lib/auth";

const router = Router();

async function formatAppointment(a: typeof appointmentsTable.$inferSelect) {
  const [patient] = await db.select({ fullName: patientsTable.fullName, phone: patientsTable.phone }).from(patientsTable).where(eq(patientsTable.id, a.patientId));
  const [doctor] = await db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, a.doctorId));
  return {
    id: a.id,
    patientId: a.patientId,
    patientName: patient?.fullName ?? "",
    patientPhone: patient?.phone ?? null,
    doctorId: a.doctorId,
    doctorName: doctor?.fullName ?? "",
    appointmentDate: a.appointmentDate,
    appointmentTime: a.appointmentTime ?? null,
    reason: a.reason ?? null,
    status: a.status,
    notes: a.notes ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

router.get("/appointments", authenticate, async (req, res): Promise<void> => {
  const params = ListAppointmentsQueryParams.safeParse(req.query);
  const page = params.success && params.data.page ? Number(params.data.page) : 1;
  const limit = params.success && params.data.limit ? Number(params.data.limit) : 20;
  const date = params.success ? params.data.date : undefined;
  const doctorId = params.success ? params.data.doctorId : undefined;
  const status = params.success ? params.data.status : undefined;

  let query = db.select().from(appointmentsTable).$dynamic();
  if (date) query = query.where(eq(appointmentsTable.appointmentDate, date));
  if (doctorId) query = query.where(eq(appointmentsTable.doctorId, doctorId));
  if (status) query = query.where(eq(appointmentsTable.status, status as "scheduled" | "confirmed" | "arrived" | "in_progress" | "completed" | "cancelled" | "no_show"));

  const all = await query.orderBy(desc(appointmentsTable.appointmentDate));
  const total = all.length;
  const slice = all.slice((page - 1) * limit, page * limit);
  const data = await Promise.all(slice.map(formatAppointment));
  res.json({ data, total, page, limit });
});

router.post("/appointments", authenticate, async (req, res): Promise<void> => {
  const parsed = CreateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [appt] = await db.insert(appointmentsTable).values({
    ...parsed.data,
    createdById: req.user!.id,
  }).returning();
  await logAudit(req, req.user!.id, "CREATE_APPOINTMENT", "appointments", appt.id);
  res.status(201).json(await formatAppointment(appt));
});

router.get("/appointments/:id", authenticate, async (req, res): Promise<void> => {
  const params = GetAppointmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [appt] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, params.data.id));
  if (!appt) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }
  res.json(await formatAppointment(appt));
});

router.patch("/appointments/:id", authenticate, async (req, res): Promise<void> => {
  const params = UpdateAppointmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [appt] = await db.update(appointmentsTable).set(parsed.data as Partial<typeof appointmentsTable.$inferInsert>).where(eq(appointmentsTable.id, params.data.id)).returning();
  if (!appt) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }
  await logAudit(req, req.user!.id, "UPDATE_APPOINTMENT", "appointments", appt.id);
  res.json(await formatAppointment(appt));
});

router.delete("/appointments/:id", authenticate, async (req, res): Promise<void> => {
  const params = CancelAppointmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.update(appointmentsTable).set({ status: "cancelled" }).where(eq(appointmentsTable.id, params.data.id));
  await logAudit(req, req.user!.id, "CANCEL_APPOINTMENT", "appointments", params.data.id);
  res.sendStatus(204);
});

export default router;
