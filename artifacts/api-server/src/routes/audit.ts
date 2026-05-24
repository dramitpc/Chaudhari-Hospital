import { Router } from "express";
import { eq, desc, gte, lte, and } from "drizzle-orm";
import { db, auditLogsTable, usersTable } from "@workspace/db";
import { ListAuditLogsQueryParams } from "@workspace/api-zod";
import { authenticate, requireRole } from "../middlewares/authenticate";

const router = Router();

router.get("/audit-logs", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const params = ListAuditLogsQueryParams.safeParse(req.query);
  const page = params.success && params.data.page ? Number(params.data.page) : 1;
  const limit = params.success && params.data.limit ? Number(params.data.limit) : 50;

  let query = db.select().from(auditLogsTable).$dynamic();
  if (params.success && params.data.userId) query = query.where(eq(auditLogsTable.userId, params.data.userId));
  if (params.success && params.data.action) query = query.where(eq(auditLogsTable.action, params.data.action));
  if (params.success && params.data.resource) query = query.where(eq(auditLogsTable.resource, params.data.resource));

  const all = await query.orderBy(desc(auditLogsTable.createdAt));
  const total = all.length;
  const slice = all.slice((page - 1) * limit, page * limit);

  const data = await Promise.all(slice.map(async (log) => {
    const user = log.userId
      ? (await db.select({ fullName: usersTable.fullName, role: usersTable.role }).from(usersTable).where(eq(usersTable.id, log.userId)))[0]
      : null;
    return {
      id: log.id,
      userId: log.userId ?? "",
      userName: user?.fullName ?? "System",
      userRole: user?.role ?? "system",
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId ?? null,
      ipAddress: log.ipAddress ?? null,
      details: log.details ?? null,
      createdAt: log.createdAt.toISOString(),
    };
  }));

  res.json({ data, total, page, limit });
});

export default router;
