import { and, eq, inArray, sql } from "drizzle-orm";
import { db, queueTokensTable } from "@workspace/db";
import { startTiming, stopTiming } from "./consultationTiming";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Status = typeof queueTokensTable.$inferSelect.status;

export class QueueTransitionError extends Error {}

export async function lockDoctor(tx: Transaction, doctorId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${doctorId + ":active-timing"}))`);
}

export async function transitionQueueToken(tx: Transaction, id: string, status: Status) {
  const [original] = await tx.select().from(queueTokensTable).where(eq(queueTokensTable.id, id));
  if (!original) return undefined;
  await lockDoctor(tx, original.doctorId);
  const [current] = await tx.select().from(queueTokensTable).where(eq(queueTokensTable.id, id)).for("update");
  if (current.status === status) return current;
  if (current.status === "completed" && status === "consultation_done") return current;

  const allowed: Record<Status, Status[]> = {
    waiting: ["called", "in_consultation", "cancelled"],
    called: ["waiting", "in_consultation", "cancelled"],
    in_consultation: ["paused", "awaiting_investigations", "consultation_done", "completed", "cancelled"],
    paused: ["awaiting_investigations", "ready_for_review", "in_consultation", "consultation_done", "completed", "cancelled"],
    awaiting_investigations: ["ready_for_review", "in_consultation", "cancelled"],
    ready_for_review: ["called", "in_consultation", "awaiting_investigations", "cancelled"],
    consultation_done: ["completed"],
    completed: [],
    skipped: ["waiting", "cancelled"],
    cancelled: [],
  };
  if (!allowed[current.status].includes(status)) {
    throw new QueueTransitionError(`Cannot change ${current.status.replaceAll("_", " ")} to ${status.replaceAll("_", " ")}`);
  }

  const now = new Date();
  // A doctor can have only one running session, even across tabs/devices.
  if (status === "in_consultation" || status === "called") {
    const active = await tx.select().from(queueTokensTable).where(and(
      eq(queueTokensTable.doctorId, current.doctorId),
      inArray(queueTokensTable.status, ["in_consultation", "called"]),
    )).for("update");
    for (const token of active) {
      if (token.id !== id) {
        await tx.update(queueTokensTable).set({
          ...stopTiming(token, now),
          status: token.status === "called" ? (token.sessionCount > 0 ? "ready_for_review" : "waiting") : "paused",
        })
          .where(eq(queueTokensTable.id, token.id));
      }
    }
  }

  const timing = status === "in_consultation" ? startTiming(current, now) : stopTiming(current, now);
  const ended = status === "consultation_done" || status === "completed";
  const [updated] = await tx.update(queueTokensTable).set({
    ...timing,
    status,
    ...(ended ? { consultationEndedAt: current.consultationEndedAt ?? now } : {}),
  }).where(eq(queueTokensTable.id, id)).returning();
  return updated;
}

export function updateQueueTokenStatus(id: string, status: Status) {
  return db.transaction(tx => transitionQueueToken(tx, id, status));
}