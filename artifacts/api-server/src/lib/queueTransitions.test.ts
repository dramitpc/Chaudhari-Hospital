import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { db, pool, queueTokensTable, usersTable, patientsTable } from "@workspace/db";
import { transitionQueueToken, QueueTransitionError } from "./queueTransitions";

test("database transitions pause without completing, preserve timing, and are repeat-safe", async () => {
  const rollback = new Error("Rollback isolated timing test fixtures");
  try {
    await db.transaction(async tx => {
      const [doctor] = await tx.select({ id: usersTable.id }).from(usersTable).limit(1);
      const [patient] = await tx.select({ id: patientsTable.id }).from(patientsTable).limit(1);
      assert.ok(doctor && patient, "Development database must contain a user and a patient");
      const date = `timing-test-${crypto.randomUUID()}`;
      const [a, b, legacy] = await tx.insert(queueTokensTable).values([1, 2, 3].map(n => ({
        tokenNumber: n, sortOrder: n, doctorId: doctor.id, patientId: patient.id, queueDate: date,
        ...(n === 3 ? { consultationStartedAt: new Date(Date.now() - 3600000), status: "paused" as const } : {}),
      }))).returning();
      const called = await transitionQueueToken(tx, a.id, "called");
      assert.equal(called!.consultationStartedAt, null, "Calling must not start the timer");
      const first = await transitionQueueToken(tx, a.id, "in_consultation");
      await tx.update(queueTokensTable).set({ activeStartedAt: new Date(Date.now() - 480000) }).where(eq(queueTokensTable.id, a.id));
      await transitionQueueToken(tx, b.id, "called");
      const [paused] = await tx.select().from(queueTokensTable).where(eq(queueTokensTable.id, a.id));
      assert.equal(paused.status, "paused");
      assert.equal(paused.activeSeconds, 480);
      assert.equal(paused.consultationEndedAt, null, "Calling next must not complete the previous visit");
      await transitionQueueToken(tx, a.id, "awaiting_investigations");
      const ready = await transitionQueueToken(tx, a.id, "ready_for_review");
      assert.equal(ready!.activeStartedAt, null, "Ready results must not restart timing");
      assert.equal(ready!.activeSeconds, 480);
      const resumed = await transitionQueueToken(tx, a.id, "in_consultation");
      assert.equal(resumed!.consultationStartedAt!.getTime(), first!.consultationStartedAt!.getTime());
      assert.equal(resumed!.sessionCount, 2);
      await tx.update(queueTokensTable).set({ activeStartedAt: new Date(Date.now() - 300000) }).where(eq(queueTokensTable.id, a.id));
      const done = await transitionQueueToken(tx, a.id, "consultation_done");
      assert.equal(done!.activeSeconds, 780);
      assert.equal(done!.activeStartedAt, null);
      const completed = await transitionQueueToken(tx, a.id, "completed");
      assert.equal(completed!.consultationEndedAt!.getTime(), done!.consultationEndedAt!.getTime(), "Billing completion must not extend consultation time");
      assert.equal((await transitionQueueToken(tx, a.id, "completed"))!.activeSeconds, 780);
      await assert.rejects(() => transitionQueueToken(tx, a.id, "in_consultation"), QueueTransitionError);
      await transitionQueueToken(tx, legacy.id, "in_consultation");
      assert.equal((await transitionQueueToken(tx, legacy.id, "paused"))!.activeSeconds, null);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await pool.end();
  }
});