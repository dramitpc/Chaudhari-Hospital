import { Link } from "wouter";
import { useListPrescriptions, getListPrescriptionsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/dateUtils";

export default function PrescriptionsPage() {
  const localToday = new Date().toLocaleDateString("en-CA");

  const { data, isLoading } = useListPrescriptions(
    { date: localToday, limit: 500 },
    { query: { queryKey: getListPrescriptionsQueryKey({ date: localToday, limit: 500 }) } }
  );

  const prescriptions = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Prescriptions</h1>
          <p className="text-sm text-muted-foreground">Today — {fmtDate(localToday)} · {total} prescription{total !== 1 ? "s" : ""}</p>
        </div>
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
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No prescriptions generated today</td></tr>
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
