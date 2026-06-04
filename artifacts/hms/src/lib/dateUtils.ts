type DateInput = Date | string | number | null | undefined;

function toDate(d: DateInput): Date | null {
  if (d == null) return null;
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date.getTime()) ? null : date;
}

/** Display a date as DD/MM/YYYY */
export function fmtDate(d: DateInput): string {
  const date = toDate(d);
  if (!date) return "—";
  return date.toLocaleDateString("en-GB"); // → DD/MM/YYYY
}

/** Display a date-time as DD/MM/YYYY, HH:mm */
export function fmtDateTime(d: DateInput): string {
  const date = toDate(d);
  if (!date) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }); // → DD/MM/YYYY, HH:mm
}
