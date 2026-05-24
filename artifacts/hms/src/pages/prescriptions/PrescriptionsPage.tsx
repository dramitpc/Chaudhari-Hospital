import { useState } from "react";
import { Link } from "wouter";
import { useListPrescriptions, getListPrescriptionsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function PrescriptionsPage() {
  const today = new Date().toISOString().split("T")[0];
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useListPrescriptions(
    { page, limit },
    { query: { queryKey: getListPrescriptionsQueryKey({ page, limit }) } }
  );

  const prescriptions = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prescriptions</h1>
          <p className="text-sm text-muted-foreground">{total} total</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Patient</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Doctor</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
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
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No prescriptions found</td></tr>
            ) : prescriptions.map(p => (
              <tr key={p.id} className="border-b border-border hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{p.patientName}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.doctorName}</td>
                <td className="px-4 py-3">{p.visitDate}</td>
                <td className="px-4 py-3 max-w-[180px] truncate text-muted-foreground">{p.diagnosis ?? "—"}</td>
                <td className="px-4 py-3">{p.items.length} drugs</td>
                <td className="px-4 py-3 flex gap-2">
                  <Link href={`/prescriptions/${p.id}`}>
                    <Button size="sm" variant="outline">View</Button>
                  </Link>
                  <Link href={`/prescriptions/${p.id}`}>
                    <Button size="sm" variant="ghost">Print</Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
