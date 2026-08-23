import { Router } from "express";
import { eq, desc, and, notInArray, sql, SQL } from "drizzle-orm";
import { db, investigationsTable, invoicesTable, chargeTypesTable, patientsTable } from "@workspace/db";
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

    // If linked to a consultation, append investigation charge to its invoice
    if (row.consultationId) {
      // Find the active invoice for this consultation (any non-terminal status)
      const [invoice] = await db.select().from(invoicesTable)
        .where(and(
          eq(invoicesTable.consultationId, row.consultationId),
          notInArray(invoicesTable.status, ["paid", "cancelled", "refunded"])
        ));

      // Look up investigation charge type by name match
      const chargeTypes = await db.select().from(chargeTypesTable)
        .where(and(eq(chargeTypesTable.category, "investigation"), eq(chargeTypesTable.isActive, true)));
      const matched = chargeTypes.find(
        ct => ct.name.toLowerCase() === row.type.toLowerCase()
      );
      const newItem = {
        chargeTypeId: matched?.id ?? null,
        description: row.type + (row.bodyPart ? ` (${row.bodyPart})` : ""),
        quantity: 1,
        unitPrice: matched?.unitPrice ?? 0,
        tax: 0,
        total: matched?.unitPrice ?? 0,
      };

      if (invoice) {
        // Merge with existing item of same type, or append new line
        const existingItems = (invoice.items as typeof newItem[]) ?? [];
        const matchKey = matched?.id ?? null;
        const existingIdx = existingItems.findIndex(i =>
          matchKey !== null ? i.chargeTypeId === matchKey : i.description === newItem.description
        );
        let updatedItems: typeof existingItems;
        if (existingIdx >= 0) {
          updatedItems = existingItems.map((item, idx) => {
            if (idx !== existingIdx) return item;
            const qty = (item.quantity ?? 1) + 1;
            return { ...item, quantity: qty, total: qty * item.unitPrice };
          });
        } else {
          updatedItems = [...existingItems, newItem];
        }
        const subtotal = updatedItems.reduce((s, i) => s + i.total, 0);
        const newTotal = subtotal - (invoice.discount ?? 0) + (invoice.tax ?? 0);
        const newBalance = Math.max(0, newTotal - (invoice.amountPaid ?? 0));
        await db.update(invoicesTable).set({
          items: updatedItems,
          subtotal,
          total: newTotal,
          balance: newBalance,
        }).where(eq(invoicesTable.id, invoice.id));
      } else {
        // No invoice yet — check once more (another concurrent request may have just created one)
        const [raceInvoice] = await db.select().from(invoicesTable)
          .where(and(
            eq(invoicesTable.consultationId, row.consultationId),
            notInArray(invoicesTable.status, ["paid", "cancelled", "refunded"])
          ));
        if (raceInvoice) {
          // Another request beat us — append to that invoice instead
          const existingItems = (raceInvoice.items as typeof newItem[]) ?? [];
          const matchKey = matched?.id ?? null;
          const existingIdx = existingItems.findIndex(i =>
            matchKey !== null ? i.chargeTypeId === matchKey : i.description === newItem.description
          );
          let updatedItems: typeof existingItems;
          if (existingIdx >= 0) {
            updatedItems = existingItems.map((item, idx) => {
              if (idx !== existingIdx) return item;
              const qty = (item.quantity ?? 1) + 1;
              return { ...item, quantity: qty, total: qty * item.unitPrice };
            });
          } else {
            updatedItems = [...existingItems, newItem];
          }
          const subtotal = updatedItems.reduce((s, i) => s + i.total, 0);
          const newTotal = subtotal - (raceInvoice.discount ?? 0) + (raceInvoice.tax ?? 0);
          await db.update(invoicesTable).set({
            items: updatedItems,
            subtotal,
            total: newTotal,
            balance: Math.max(0, newTotal - (raceInvoice.amountPaid ?? 0)),
          }).where(eq(invoicesTable.id, raceInvoice.id));
        } else {
          // Truly no invoice — create one for this consultation
          const [patientExists] = await db.select({ id: patientsTable.id })
            .from(patientsTable).where(eq(patientsTable.id, row.patientId));
          if (patientExists) {
            const now = new Date();
            const y = now.getFullYear().toString().slice(-2);
            const mo = String(now.getMonth() + 1).padStart(2, "0");
            const d = String(now.getDate()).padStart(2, "0");
            const rand = Math.floor(Math.random() * 9000) + 1000;
            await db.insert(invoicesTable).values({
              invoiceNumber: `INV-${y}${mo}${d}-${rand}`,
              patientId: row.patientId,
              consultationId: row.consultationId,
              items: [newItem],
              subtotal: newItem.total,
              discount: 0,
              tax: 0,
              total: newItem.total,
              amountPaid: 0,
              balance: newItem.total,
              status: "pending",
              createdById: req.user!.id,
            });
          }
        }
      }
    }

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
