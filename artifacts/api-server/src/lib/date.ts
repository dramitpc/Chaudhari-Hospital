const CLINIC_TZ = "Asia/Kolkata";

export function localDateStr(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CLINIC_TZ }).format(d);
}

export function dayBounds(dateStr: string): [Date, Date] {
  const start = new Date(dateStr + "T00:00:00+05:30");
  const end   = new Date(start.getTime() + 86_400_000);
  return [start, end];
}

export function rangeBounds(startDate: string, endDate: string): [Date, Date] {
  const start = new Date(startDate + "T00:00:00+05:30");
  const end   = new Date(endDate   + "T00:00:00+05:30");
  end.setTime(end.getTime() + 86_400_000);
  return [start, end];
}
