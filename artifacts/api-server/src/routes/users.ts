import { Router } from "express";
import { eq, and, ilike, or, desc } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  ListUsersQueryParams,
  GetUserParams,
  UpdateUserParams,
  UpdateUserBody,
  DeleteUserParams,
  AdminResetPasswordParams,
  AdminResetPasswordBody,
  CreateUserBody,
} from "@workspace/api-zod";
import { authenticate, requireRole } from "../middlewares/authenticate";
import { hashPassword, logAudit } from "../lib/auth";

const router = Router();

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    fullName: u.fullName,
    email: u.email ?? null,
    phone: u.phone ?? null,
    registrationNumber: u.registrationNumber ?? null,
    specialization: u.specialization ?? null,
    consultingHours: u.consultingHours ?? null,
    signatureData: u.signatureData ?? null,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
  };
}

router.get("/users/doctors", authenticate, async (req, res): Promise<void> => {
  const doctors = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.role, "doctor"), eq(usersTable.isActive, true)))
    .orderBy(usersTable.fullName);
  res.json({ data: doctors.map(formatUser) });
});

router.get("/users", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const params = ListUsersQueryParams.safeParse(req.query);
  const page = params.success && params.data.page ? Number(params.data.page) : 1;
  const limit = params.success && params.data.limit ? Number(params.data.limit) : 20;
  const search = params.success ? params.data.search : undefined;
  const role = params.success ? params.data.role : undefined;

  let query = db.select().from(usersTable).$dynamic();
  if (search) {
    query = query.where(or(ilike(usersTable.fullName, `%${search}%`), ilike(usersTable.username, `%${search}%`)));
  }
  if (role) {
    query = query.where(eq(usersTable.role, role as "admin" | "doctor" | "staff"));
  }

  const all = await query.orderBy(desc(usersTable.createdAt));
  const total = all.length;
  const data = all.slice((page - 1) * limit, page * limit).map(formatUser);
  res.json({ data, total, page, limit });
});

router.post("/users", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { password, ...rest } = parsed.data as { password: string; username: string; role: "admin" | "doctor" | "staff"; fullName: string; email?: string; phone?: string; registrationNumber?: string; specialization?: string };
  const passwordHash = hashPassword(password);
  try {
    const [user] = await db.insert(usersTable).values({ ...rest, passwordHash }).returning();
    await logAudit(req, req.user!.id, "CREATE_USER", "users", user.id);
    res.status(201).json(formatUser(user));
  } catch (err: unknown) {
    const pgErr = err as { code?: string; constraint?: string };
    if (pgErr.code === "23505") {
      const field = pgErr.constraint?.includes("username") ? "username" : "email";
      res.status(409).json({ error: `A user with that ${field} already exists.` });
      return;
    }
    throw err;
  }
});

router.get("/users/:id", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(formatUser(user));
});

router.patch("/users/:id", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.update(usersTable).set(parsed.data as Partial<typeof usersTable.$inferInsert>).where(eq(usersTable.id, params.data.id)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  await logAudit(req, req.user!.id, "UPDATE_USER", "users", user.id);
  res.json(formatUser(user));
});

router.delete("/users/:id", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, params.data.id));
  await logAudit(req, req.user!.id, "DELETE_USER", "users", params.data.id);
  res.sendStatus(204);
});

router.post("/users/:id/reset-password", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const params = AdminResetPasswordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = AdminResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const newHash = hashPassword(parsed.data.newPassword);
  await db.update(usersTable).set({ passwordHash: newHash, refreshToken: null }).where(eq(usersTable.id, params.data.id));
  await logAudit(req, req.user!.id, "RESET_PASSWORD", "users", params.data.id);
  res.json({ ok: true });
});

export default router;
