import assert from "node:assert/strict";
import { test } from "node:test";
import { averageMinutes, estimateDoctorQueue, runningSeconds, startTiming, stopTiming, type TimingRecord } from "./consultationTiming";

const at = (minutes: number) => new Date(Date.UTC(2026, 0, 1, 9, minutes));
const blank = (): TimingRecord => ({
  consultationStartedAt: null, consultationEndedAt: null, activeStartedAt: null,
  activeSeconds: null, initialSeconds: null, reviewSeconds: 0, sessionCount: 0,
});

test("8 minute assessment + 25 minute wait + 5 minute review counts as 13 active minutes", () => {
  let record = { ...blank(), ...startTiming(blank(), at(0)) };
  record = { ...record, ...stopTiming(record, at(8)) };
  assert.equal(record.activeSeconds, 480);
  assert.equal(runningSeconds(record, at(33)), 0);
  record = { ...record, ...startTiming(record, at(33)) };
  record = { ...record, ...stopTiming(record, at(38)) };
  assert.equal(record.activeSeconds, 780);
  assert.equal(record.initialSeconds, 480);
  assert.equal(record.reviewSeconds, 300);
  assert.equal(record.sessionCount, 2);
  assert.equal(record.consultationStartedAt!.getTime(), at(0).getTime());
  assert.equal(averageMinutes([record.activeSeconds!]), 13);
});

test("repeated stop/start operations do not double count or reset a session", () => {
  let record = { ...blank(), ...startTiming(blank(), at(0)) };
  assert.deepEqual(startTiming(record, at(2)), {});
  record = { ...record, ...stopTiming(record, at(8)) };
  assert.equal(stopTiming(record, at(33)).activeSeconds, 480);
  assert.equal(stopTiming(record, at(33)).initialSeconds, 480);
});

test("legacy records remain excluded from active averages after resuming", () => {
  const legacy = { ...blank(), consultationStartedAt: at(0) };
  const resumed = { ...legacy, ...startTiming(legacy, at(30)) };
  assert.equal(stopTiming(resumed, at(35)).activeSeconds, null);
  assert.equal(averageMinutes([]), null);
});

test("negative clock offsets never subtract time", () => {
  const started = { ...blank(), ...startTiming(blank(), at(5)) };
  assert.equal(stopTiming(started, at(4)).activeSeconds, 0);
});

const queued = (id: string, status: string, order: number) => ({
  ...blank(), id, status, priority: 0, sortOrder: order, tokenNumber: order,
});

test("review-ready patients go first, using remaining active work, not investigation wait", () => {
  const sample = { ...blank(), activeSeconds: 780, initialSeconds: 480, reviewSeconds: 300, sessionCount: 2 };
  const active = { ...queued("active", "in_consultation", 1), activeStartedAt: at(0), activeSeconds: 0, sessionCount: 1 };
  assert.deepEqual(estimateDoctorQueue([
    active, queued("new", "waiting", 2), queued("review", "ready_for_review", 3),
    queued("xray", "awaiting_investigations", 4), queued("paused", "paused", 5),
  ], [sample], at(3)), [
    { id: "review", estimatedWaitMinutes: 5 },
    { id: "new", estimatedWaitMinutes: 10 },
  ]);
});

test("empty data uses 8 minute first visits and 5 minute reviews; priority matches calling order", () => {
  const urgent = { ...queued("urgent", "waiting", 3), priority: 10 };
  assert.deepEqual(estimateDoctorQueue([
    queued("normal", "waiting", 1), urgent, queued("review", "ready_for_review", 4),
  ], [], at(0)), [
    { id: "urgent", estimatedWaitMinutes: 0 },
    { id: "review", estimatedWaitMinutes: 8 },
    { id: "normal", estimatedWaitMinutes: 13 },
  ]);
});

test("overdue running sessions still have nonzero remaining wait", () => {
  assert.equal(estimateDoctorQueue([
    { ...queued("active", "in_consultation", 1), activeStartedAt: at(0), sessionCount: 1 },
    queued("next", "waiting", 2),
  ], [], at(30))[0].estimatedWaitMinutes, 1);
});