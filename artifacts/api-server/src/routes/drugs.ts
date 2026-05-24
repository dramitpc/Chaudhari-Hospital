import { Router } from "express";
import { eq, ilike, desc } from "drizzle-orm";
import { db, drugsTable } from "@workspace/db";
import {
  ListDrugsQueryParams,
  CreateDrugBody,
  UpdateDrugParams,
  UpdateDrugBody,
  DeleteDrugParams,
} from "@workspace/api-zod";
import { authenticate, requireRole } from "../middlewares/authenticate";

const router = Router();

function formatDrug(d: typeof drugsTable.$inferSelect) {
  return {
    id: d.id,
    name: d.name,
    genericName: d.genericName ?? null,
    category: d.category ?? null,
    form: d.form ?? null,
    strength: d.strength ?? null,
    manufacturer: d.manufacturer ?? null,
    defaultDosage: d.defaultDosage ?? null,
    defaultFrequency: d.defaultFrequency ?? null,
    defaultDuration: d.defaultDuration ?? null,
    defaultInstructions: d.defaultInstructions ?? null,
    isActive: d.isActive,
    createdAt: d.createdAt.toISOString(),
  };
}

router.get("/drugs", authenticate, async (req, res): Promise<void> => {
  const params = ListDrugsQueryParams.safeParse(req.query);
  const page = params.success && params.data.page ? Number(params.data.page) : 1;
  const limit = params.success && params.data.limit ? Number(params.data.limit) : 50;
  const search = params.success ? params.data.search : undefined;

  let query = db.select().from(drugsTable).where(eq(drugsTable.isActive, true)).$dynamic();
  if (search) query = query.where(ilike(drugsTable.name, `%${search}%`));

  const all = await query.orderBy(drugsTable.name);
  const total = all.length;
  const data = all.slice((page - 1) * limit, page * limit).map(formatDrug);
  res.json({ data, total, page, limit });
});

router.post("/drugs", authenticate, requireRole("admin", "doctor"), async (req, res): Promise<void> => {
  const parsed = CreateDrugBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [drug] = await db.insert(drugsTable).values(parsed.data).returning();
  res.status(201).json(formatDrug(drug));
});

router.patch("/drugs/:id", authenticate, requireRole("admin", "doctor"), async (req, res): Promise<void> => {
  const params = UpdateDrugParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateDrugBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [drug] = await db.update(drugsTable).set(parsed.data).where(eq(drugsTable.id, params.data.id)).returning();
  if (!drug) {
    res.status(404).json({ error: "Drug not found" });
    return;
  }
  res.json(formatDrug(drug));
});

router.delete("/drugs/:id", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const params = DeleteDrugParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.update(drugsTable).set({ isActive: false }).where(eq(drugsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
