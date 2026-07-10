import { Router } from "express";
import { and, eq, desc } from "drizzle-orm";
import { db, userSavedItemsTable } from "@workspace/db";
import {
  ListSavedItemsQueryParams,
  CreateSavedItemBody,
  DeleteSavedItemParams,
} from "@workspace/api-zod";
import { authenticate } from "../middlewares/authenticate";

const router = Router();

const RECENT_CAP = 8;

function formatItem(i: typeof userSavedItemsTable.$inferSelect) {
  return {
    id: i.id,
    namespace: i.namespace,
    kind: i.kind,
    name: i.name,
    payload: i.payload as Record<string, unknown>,
    createdAt: i.createdAt.toISOString(),
  };
}

router.get("/saved-items", authenticate, async (req, res): Promise<void> => {
  const params = ListSavedItemsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const conditions = [
    eq(userSavedItemsTable.userId, req.user!.id),
    eq(userSavedItemsTable.namespace, params.data.namespace),
  ];
  if (params.data.kind) conditions.push(eq(userSavedItemsTable.kind, params.data.kind));

  const rows = await db
    .select()
    .from(userSavedItemsTable)
    .where(and(...conditions))
    .orderBy(desc(userSavedItemsTable.createdAt));

  res.json({ data: rows.map(formatItem) });
});

router.post("/saved-items", authenticate, async (req, res): Promise<void> => {
  const parsed = CreateSavedItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { namespace, kind, name, payload, dedupeKey } = parsed.data;
  const userId = req.user!.id;

  if (kind === "recent") {
    const existing = await db
      .select()
      .from(userSavedItemsTable)
      .where(and(
        eq(userSavedItemsTable.userId, userId),
        eq(userSavedItemsTable.namespace, namespace),
        eq(userSavedItemsTable.kind, "recent"),
      ))
      .orderBy(desc(userSavedItemsTable.createdAt));

    const toRemove = existing.filter(e =>
      dedupeKey !== undefined && (e.payload as Record<string, unknown>)?.["__dedupeKey"] === dedupeKey
    );
    const overflow = existing.slice(RECENT_CAP - 1);
    const removeIds = new Set([...toRemove, ...overflow].map(e => e.id));
    if (removeIds.size > 0) {
      for (const id of removeIds) {
        await db.delete(userSavedItemsTable).where(eq(userSavedItemsTable.id, id));
      }
    }
  }

  const storedPayload = dedupeKey !== undefined ? { ...payload, __dedupeKey: dedupeKey } : payload;

  const [item] = await db.insert(userSavedItemsTable).values({
    userId,
    namespace,
    kind,
    name: name ?? "",
    payload: storedPayload,
  }).returning();

  res.status(201).json(formatItem(item));
});

router.delete("/saved-items/:id", authenticate, async (req, res): Promise<void> => {
  const params = DeleteSavedItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(userSavedItemsTable).where(and(
    eq(userSavedItemsTable.id, params.data.id),
    eq(userSavedItemsTable.userId, req.user!.id),
  ));
  res.sendStatus(204);
});

export default router;
