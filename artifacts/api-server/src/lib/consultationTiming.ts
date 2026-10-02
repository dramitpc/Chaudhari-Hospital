export interface TimingRecord {
  consultationStartedAt: Date | null;
  consultationEndedAt: Date | null;
  activeStartedAt: Date | null;
  activeSeconds: number | null;
  initialSeconds: number | null;
  reviewSeconds: number;
  sessionCount: number;
}

export function runningSeconds(record: TimingRecord, now: Date): number {
  return record.activeStartedAt
    ? Math.max(0, Math.floor((now.getTime() - record.activeStartedAt.getTime()) / 1000))
    : 0;
}

export function stopTiming(record: TimingRecord, now: Date) {
  const seconds = runningSeconds(record, now);
  return {
    activeStartedAt: null,
    activeSeconds: record.activeSeconds === null ? null : record.activeSeconds + seconds,
    initialSeconds: record.activeStartedAt && record.sessionCount === 1
      ? (record.initialSeconds ?? 0) + seconds : record.initialSeconds,
    reviewSeconds: record.reviewSeconds + (record.activeStartedAt && record.sessionCount > 1 ? seconds : 0),
  };
}

export function startTiming(record: TimingRecord, now: Date) {
  if (record.activeStartedAt) return {};
  return {
    // A visit already started before active tracking was introduced remains legacy.
    activeSeconds: record.consultationStartedAt ? record.activeSeconds : 0,
    consultationStartedAt: record.consultationStartedAt ?? now,
    consultationEndedAt: null,
    activeStartedAt: now,
    sessionCount: record.sessionCount + 1,
  };
}

export function averageMinutes(seconds: number[], fallback?: number): number | null {
  return seconds.length
    ? Math.max(1, Math.round(seconds.reduce((a, b) => a + b, 0) / seconds.length / 60))
    : fallback ?? null;
}

export function queueRank(status: string): number {
  return status === "ready_for_review" ? 0 : 1;
}

export interface QueueTimingRecord extends TimingRecord {
  id: string;
  status: string;
  priority: number;
  sortOrder: number;
  tokenNumber: number;
}

/** Input records must all belong to the same doctor/date. */
export function estimateDoctorQueue(tokens: QueueTimingRecord[], samples: TimingRecord[], now: Date) {
  const measured = samples.filter(t => t.activeSeconds !== null);
  const fullAvg = averageMinutes(measured.map(t => t.activeSeconds!), 8)!;
  const initialAvg = averageMinutes(measured.filter(t => t.initialSeconds !== null).map(t => t.initialSeconds!), fullAvg)!;
  const reviews = measured.filter(t => t.sessionCount > 1);
  const reviewCount = reviews.reduce((sum, t) => sum + t.sessionCount - 1, 0);
  const reviewAvg = reviewCount
    ? Math.max(1, Math.round(reviews.reduce((sum, t) => sum + t.reviewSeconds, 0) / reviewCount / 60)) : 5;
  let wait = tokens.filter(t => t.status === "in_consultation" || t.status === "called")
    .reduce((sum, t) => sum + (t.status === "called" ? (t.sessionCount > 0 ? reviewAvg : fullAvg)
      : Math.max(1, (t.sessionCount > 1 ? reviewAvg : initialAvg) - runningSeconds(t, now) / 60)), 0);
  const ready = tokens.filter(t => t.status === "waiting" || t.status === "ready_for_review")
    .sort((a, b) => b.priority - a.priority || queueRank(a.status) - queueRank(b.status) || a.sortOrder - b.sortOrder || a.tokenNumber - b.tokenNumber);
  return ready.map(t => {
    const estimatedWaitMinutes = Math.ceil(wait);
    wait += t.status === "ready_for_review" ? reviewAvg : fullAvg;
    return { id: t.id, estimatedWaitMinutes };
  });
}