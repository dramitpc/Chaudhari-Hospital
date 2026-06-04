type DateInput = Date | string | number | null | undefined;

function toDate(d: DateInput): Date | null {
  if (d == null) return null;
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date.getTime()) ? null : date;
}

/** Calculate age in whole years from a date of birth */
export function calcAge(dob: DateInput): number | null {
  const birth = toDate(dob);
  if (!birth) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
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
