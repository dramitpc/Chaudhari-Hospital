import { useState } from "react";
import { Link } from "wouter";
import {
  useListConsultations, useListUsers, useCompleteConsultation,
  getListConsultationsQueryKey, getListUsersQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export default function ConsultationsPage() {
  const today = new Date().toLocaleDateString("en-CA");
  const [date, setDate] = useState(today);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const completeMutation = useCompleteConsultation();

  const { data, isLoading } = useListConsultations(
    { date, limit: 500 },
    { query: { queryKey: getListConsultationsQueryKey({ date, limit: 500 }) } }
  );
  const { data: users } = useListUsers({ role: "doctor" }, { query: { queryKey: getListUsersQueryKey({ role: "doctor" }) } });

  const consultations = data?.data ?? [];
  const doctors = users?.data ?? [];

  const handleComplete = (id: string) => {
    setCompletingId(id);
    completeMutation.mutate({ id, data: {} }, {
      onSuccess: () => {
        toast({ title: "Consultation completed" });
        queryClient.invalidateQueries({ queryKey: getListConsultationsQueryKey({ date, limit: 500 }) });
        setCompletingId(null);
      },
      onError: (err: unknown) => {
        const code = (err as { response?: { data?: { error?: string; balance?: number } } })?.response?.data?.error;
        if (code === "UNPAID_BALANCE") {
          const balance = (err as { response?: { data?: { balance?: number } } })?.response?.data?.balance ?? 0;
          toast({
            title: `Unpaid balance ₹${balance.toFixed(2)}`,
            description: "Open the consultation to provide an override.",
            variant: "destructive",
          });
        } else {
          toast({ title: "Failed to complete consultation", variant: "destructive" });
        }
        setCompletingId(null);
      },
    });
  };

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
                  <div className="flex items-center gap-2">
                    <Link href={`/consultations/${c.id}`}>
                      <Button size="sm" variant="outline">Open</Button>
                    </Link>
                    {c.status === "in_progress" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950/30"
                        onClick={() => handleComplete(c.id)}
                        disabled={completingId === c.id}
                      >
                        {completingId === c.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <><CheckCircle className="h-3.5 w-3.5 mr-1" />Complete</>
                        }
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
