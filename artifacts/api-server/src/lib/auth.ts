import crypto from "crypto";
import { db, usersTable, auditLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import type { Request } from "express";

const JWT_SECRET = process.env.SESSION_SECRET ?? "hms-dev-secret-change-in-production";
const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes in seconds
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days

function base64UrlEncode(str: string): string {
  return Buffer.from(str).toString("base64url");
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf8");
}

function hmacSign(data: string): string {
  return crypto.createHmac("sha256", JWT_SECRET).update(data).digest("base64url");
}

export function createJWT(payload: Record<string, unknown>, expiresInSeconds: number): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = base64UrlEncode(
    JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds })
  );
  const signature = hmacSign(`${header}.${fullPayload}`);
  return `${header}.${fullPayload}.${signature}`;
}

export function verifyJWT(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    const expectedSig = hmacSign(`${header}.${payload}`);
    if (signature !== expectedSig) return null;
    const decoded = JSON.parse(base64UrlDecode(payload));
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    const testHash = crypto.scryptSync(password, salt, 64).toString("hex");
    return hash === testHash;
  } catch {
    return false;
  }
}

export function createTokenPair(userId: string, role: string, username: string) {
  const accessToken = createJWT({ sub: userId, role, username }, ACCESS_TOKEN_EXPIRY);
  const refreshToken = createJWT({ sub: userId, type: "refresh" }, REFRESH_TOKEN_EXPIRY);
  return { accessToken, refreshToken };
}

export async function logAudit(
  req: Request,
  userId: string | null,
  action: string,
  resource: string,
  resourceId?: string,
  details?: string
) {
  try {
    await db.insert(auditLogsTable).values({
      userId: userId ?? undefined,
      action,
      resource,
      resourceId,
      ipAddress: req.ip ?? req.socket?.remoteAddress,
      details,
    });
  } catch (err) {
    logger.warn({ err }, "Failed to write audit log");
  }
}
