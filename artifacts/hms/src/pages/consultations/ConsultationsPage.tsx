import { useState } from "react";
import { Link } from "wouter";
import {
  useListConsultations, useListUsers,
  getListConsultationsQueryKey, getListUsersQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const statusColors: Record<string, string> = {
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export default function ConsultationsPage() {
  const today = new Date().toLocaleDateString("en-CA");
  const [date, setDate] = useState(today);

  const { data, isLoading } = useListConsultations(
    { date, limit: 500 },
    { query: { queryKey: getListConsultationsQueryKey({ date, limit: 500 }) } }
  );
  const { data: users } = useListUsers({ role: "doctor" }, { query: { queryKey: getListUsersQueryKey({ role: "doctor" }) } });

  const consultations = data?.data ?? [];
  const doctors = users?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Consultations</h1>
          <p className="text-sm text-muted-foreground">{consultations.length} consultations</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Date</Label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44" />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Patient</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Doctor</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Chief Complaint</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-border">
                {Array.from({ length: 6 }).map((__, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}
              </tr>
            )) : consultations.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No consultations for this date</td></tr>
            ) : consultations.map(c => (
              <tr key={c.id} className="border-b border-border hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{c.patientName}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.doctorName}</td>
                <td className="px-4 py-3">{c.visitDate}</td>
                <td className="px-4 py-3 max-w-[200px] truncate text-muted-foreground">{c.chiefComplaint ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusColors[c.status] ?? ""}`}>
                    {c.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/consultations/${c.id}`}>
                    <Button size="sm" variant="outline">Open</Button>
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
