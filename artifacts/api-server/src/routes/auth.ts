import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  LoginBody,
  RefreshTokenBody,
  ChangePasswordBody,
} from "@workspace/api-zod";
import { hashPassword, verifyPassword, createTokenPair, verifyJWT, logAudit } from "../lib/auth";
import { authenticate } from "../middlewares/authenticate";

const router = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { username, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (!user || !user.isActive) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const valid = verifyPassword(password, user.passwordHash);
  if (!valid) {
    await logAudit(req, user.id, "LOGIN_FAILED", "auth", user.id);
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const { accessToken, refreshToken } = createTokenPair(user.id, user.role, user.username);
  await db.update(usersTable).set({ refreshToken }).where(eq(usersTable.id, user.id));
  await logAudit(req, user.id, "LOGIN", "auth", user.id);
  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      registrationNumber: user.registrationNumber,
      specialization: user.specialization,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.post("/auth/refresh", async (req, res): Promise<void> => {
  const parsed = RefreshTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing refreshToken" });
    return;
  }
  const payload = verifyJWT(parsed.data.refreshToken);
  if (!payload || payload.type !== "refresh" || typeof payload.sub !== "string") {
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.sub));
  if (!user || !user.isActive || user.refreshToken !== parsed.data.refreshToken) {
    res.status(401).json({ error: "Refresh token revoked" });
    return;
  }
  const { accessToken, refreshToken } = createTokenPair(user.id, user.role, user.username);
  await db.update(usersTable).set({ refreshToken }).where(eq(usersTable.id, user.id));
  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      registrationNumber: user.registrationNumber,
      specialization: user.specialization,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.post("/auth/logout", authenticate, async (req, res): Promise<void> => {
  if (req.user) {
    await db.update(usersTable).set({ refreshToken: null }).where(eq(usersTable.id, req.user.id));
    await logAudit(req, req.user.id, "LOGOUT", "auth", req.user.id);
  }
  res.json({ ok: true });
});

router.get("/auth/me", authenticate, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    registrationNumber: user.registrationNumber,
    specialization: user.specialization,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  });
});

router.post("/auth/change-password", authenticate, async (req, res): Promise<void> => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (!user || !verifyPassword(parsed.data.currentPassword, user.passwordHash)) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }
  const newHash = hashPassword(parsed.data.newPassword);
  await db.update(usersTable).set({ passwordHash: newHash, refreshToken: null }).where(eq(usersTable.id, user.id));
  await logAudit(req, user.id, "CHANGE_PASSWORD", "auth", user.id);
  res.json({ ok: true });
});

export default router;
