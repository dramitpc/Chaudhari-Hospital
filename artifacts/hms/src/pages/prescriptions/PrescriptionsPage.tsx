import { useState } from "react";
import { Link } from "wouter";
import { useListPrescriptions, getListPrescriptionsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/dateUtils";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

function todayIso() {
  return new Date().toLocaleDateString("en-CA");
}

function shiftDate(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

function fmtPickerDate(iso: string) {
  const today = todayIso();
  const yesterday = shiftDate(today, -1);
  if (iso === today) return "Today";
  if (iso === yesterday) return "Yesterday";
  return fmtDate(iso + "T00:00:00");
}

export default function PrescriptionsPage() {
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const isToday = selectedDate === todayIso();

  const { data, isLoading } = useListPrescriptions(
    { date: selectedDate, limit: 500 },
    { query: { queryKey: getListPrescriptionsQueryKey({ date: selectedDate, limit: 500 }) } }
  );

  const prescriptions = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Prescriptions</h1>
          <p className="text-sm text-muted-foreground">{total} prescription{total !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Date picker */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center border border-border rounded-md bg-background shadow-sm overflow-hidden">
          <Button
            variant="ghost" size="icon"
            className="h-9 w-9 rounded-none border-r border-border"
            onClick={() => setSelectedDate(d => shiftDate(d, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="relative flex items-center">
            <CalendarDays className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              max={todayIso()}
              onChange={e => { if (e.target.value) setSelectedDate(e.target.value); }}
              className="h-9 pl-8 pr-2 text-sm bg-transparent focus:outline-none min-w-[130px] cursor-pointer"
            />
          </div>
          <span className={`px-2 text-xs font-medium border-l border-border h-9 flex items-center ${isToday ? "text-primary" : "text-muted-foreground"}`}>
            {fmtPickerDate(selectedDate)}
          </span>
          <Button
            variant="ghost" size="icon"
            className="h-9 w-9 rounded-none border-l border-border"
            disabled={isToday}
            onClick={() => setSelectedDate(d => shiftDate(d, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {!isToday && (
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setSelectedDate(todayIso())}>
            <X className="h-3.5 w-3.5" />Today
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Patient</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Doctor</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Time</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Diagnosis</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Items</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-border">
                {Array.from({ length: 6 }).map((__, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}
              </tr>
            )) : prescriptions.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No prescriptions for {fmtPickerDate(selectedDate)}</td></tr>
            ) : prescriptions.map(p => (
              <tr key={p.id} className="border-b border-border hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{p.patientName}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.doctorName}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {p.createdAt ? new Date(p.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                </td>
                <td className="px-4 py-3 max-w-[180px] truncate text-muted-foreground">{p.diagnosis ?? "—"}</td>
                <td className="px-4 py-3">{p.items.length} drug{p.items.length !== 1 ? "s" : ""}</td>
                <td className="px-4 py-3 flex gap-2">
                  <Link href={`/prescriptions/${p.id}?from=prescriptions`}>
                    <Button size="sm" variant="outline">View</Button>
                  </Link>
                  <Link href={`/prescriptions/${p.id}?from=prescriptions&print=1`}>
                    <Button size="sm" variant="ghost">Print</Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
