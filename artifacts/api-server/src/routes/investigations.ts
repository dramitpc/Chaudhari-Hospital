import { Router } from "express";
import { eq, desc, and, sql, SQL } from "drizzle-orm";
import { db, investigationsTable } from "@workspace/db";
import {
  ListInvestigationsQueryParams,
  CreateInvestigationBody,
  UpdateInvestigationParams,
  UpdateInvestigationBody,
} from "@workspace/api-zod";
import { authenticate } from "../middlewares/authenticate";
import { logAudit } from "../lib/auth";

const router = Router();

// GET /investigations
router.get(
  "/investigations",
  authenticate,
  async (req, res) => {
    const query = ListInvestigationsQueryParams.safeParse(req.query);
    if (!query.success) {
      return res.status(400).json({ error: "Invalid query parameters" });
    }

    const conditions: SQL[] = [];
    if (query.data.status) {
      conditions.push(eq(investigationsTable.status, query.data.status as "pending" | "in_progress" | "completed" | "cancelled"));
    }
    if (query.data.patientId) {
      conditions.push(eq(investigationsTable.patientId, query.data.patientId));
    }
    if (query.data.consultationId) {
      conditions.push(eq(investigationsTable.consultationId, query.data.consultationId));
    }
    if (query.data.date) {
      conditions.push(sql`DATE(${investigationsTable.createdAt}) = ${query.data.date}`);
    }

    const rows = await db
      .select()
      .from(investigationsTable)
      .where(conditions.length > 0 ? and(...conditions as [SQL, ...SQL[]]) : undefined)
      .orderBy(desc(investigationsTable.createdAt));

    return res.json({ data: rows });
  }
);

// POST /investigations
router.post(
  "/investigations",
  authenticate,
  async (req, res) => {
    const body = CreateInvestigationBody.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: "Invalid input", details: body.error.flatten() });
    }

    const [row] = await db
      .insert(investigationsTable)
      .values(body.data)
      .returning();

    await logAudit(req, req.user!.id, "create", "investigation", row.id);
    return res.status(201).json(row);
  }
);

// PATCH /investigations/:id
router.patch(
  "/investigations/:id",
  authenticate,
  async (req, res) => {
    const params = UpdateInvestigationParams.safeParse(req.params);
    if (!params.success) {
      return res.status(400).json({ error: "Invalid params" });
    }
    const body = UpdateInvestigationBody.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: "Invalid input", details: body.error.flatten() });
    }

    const updates: Record<string, unknown> = { ...body.data };
    if (body.data.status === "completed") {
      updates.completedAt = new Date();
    }

    const [row] = await db
      .update(investigationsTable)
      .set(updates)
      .where(eq(investigationsTable.id, params.data.id))
      .returning();

    if (!row) {
      return res.status(404).json({ error: "Investigation not found" });
    }

    await logAudit(req, req.user!.id, "update", "investigation", row.id);
    return res.json(row);
  }
);

// DELETE /investigations/:id
router.delete(
  "/investigations/:id",
  authenticate,
  async (req, res) => {
    const params = UpdateInvestigationParams.safeParse(req.params);
    if (!params.success) {
      return res.status(400).json({ error: "Invalid params" });
    }

    const [row] = await db
      .delete(investigationsTable)
      .where(eq(investigationsTable.id, params.data.id))
      .returning();

    if (!row) {
      return res.status(404).json({ error: "Investigation not found" });
    }

    await logAudit(req, req.user!.id, "delete", "investigation", row.id);
    return res.status(204).send();
  }
);

export default router;
