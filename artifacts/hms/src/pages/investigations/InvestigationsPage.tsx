import { useState } from "react";
import {
  useListInvestigations,
  useUpdateInvestigation,
  getListInvestigationsQueryKey,
  type Investigation,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Clock, ScanLine, AlertCircle, Filter } from "lucide-react";
import { Link } from "wouter";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  cancelled: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function InvestigationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isRadiographer = user?.role === "radiographer";
  const [statusFilter, setStatusFilter] = useState<string>(isRadiographer ? "pending" : "all");

  const params = statusFilter === "all" ? {} : { status: statusFilter as Investigation["status"] };
  const { data, isLoading } = useListInvestigations(params, {
    query: { queryKey: getListInvestigationsQueryKey(params), refetchInterval: 30000 },
  });

  const updateMutation = useUpdateInvestigation();

  const [completeDialog, setCompleteDialog] = useState<{ open: boolean; inv: Investigation | null }>({
    open: false,
    inv: null,
  });
  const [resultNotes, setResultNotes] = useState("");

  const openComplete = (inv: Investigation) => {
    setCompleteDialog({ open: true, inv });
    setResultNotes("");
  };

  const handleMarkComplete = () => {
    if (!completeDialog.inv) return;
    updateMutation.mutate(
      {
        id: completeDialog.inv.id,
        data: { status: "completed", resultNotes: resultNotes || undefined },
      },
      {
        onSuccess: () => {
          toast({ title: "Investigation marked as complete" });
          queryClient.invalidateQueries({ queryKey: getListInvestigationsQueryKey(params) });
          setCompleteDialog({ open: false, inv: null });
        },
        onError: () => toast({ title: "Failed to update", variant: "destructive" }),
      }
    );
  };

  const handleMarkInProgress = (inv: Investigation) => {
    updateMutation.mutate(
      { id: inv.id, data: { status: "in_progress" } },
      {
        onSuccess: () => {
          toast({ title: "Marked as in progress" });
          queryClient.invalidateQueries({ queryKey: getListInvestigationsQueryKey(params) });
        },
        onError: () => toast({ title: "Failed to update", variant: "destructive" }),
      }
    );
  };

  const investigations = data?.data ?? [];

  const pendingCount = investigations.filter(i => i.status === "pending").length;
  const inProgressCount = investigations.filter(i => i.status === "in_progress").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScanLine className="h-6 w-6 text-primary" />
            Investigations
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isRadiographer
              ? "Radiography job queue — mark scans as complete when done"
              : "Investigation orders for your patients"}
          </p>
        </div>
      </div>

      {/* Summary cards for radiographer */}
      {isRadiographer && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Pending", value: pendingCount, icon: Clock, color: "text-amber-600" },
            { label: "In Progress", value: inProgressCount, icon: AlertCircle, color: "text-blue-600" },
          ].map(card => (
            <div key={card.label} className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
              <card.icon className={`h-8 w-8 ${card.color}`} />
              <div>
                <p className="text-2xl font-bold">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Status:</span>
        <div className="flex gap-1 flex-wrap">
          {(isRadiographer
            ? ["pending", "in_progress", "completed", "all"]
            : ["all", "pending", "in_progress", "completed", "cancelled"]
          ).map(s => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "All" : STATUS_LABELS[s]}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : investigations.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <ScanLine className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground">
            {statusFilter === "all" ? "No investigations yet" : `No ${STATUS_LABELS[statusFilter]?.toLowerCase()} investigations`}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Patient</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Body Part</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Notes</th>
                  {!isRadiographer && (
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ordered By</th>
                  )}
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Time</th>
                  {isRadiographer && (
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {investigations.map(inv => (
                  <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      {inv.patientId ? (
                        <Link href={`/patients/${inv.patientId}`}>
                          <span className="font-medium text-primary hover:underline cursor-pointer">
                            {inv.patientName ?? inv.patientId}
                          </span>
                        </Link>
                      ) : (
                        <span className="font-medium">{inv.patientName ?? "—"}</span>
                      )}
                      {inv.consultationId && (
                        <Link href={`/consultations/${inv.consultationId}`}>
                          <span className="block text-xs text-muted-foreground hover:underline cursor-pointer">
                            View consultation →
                          </span>
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{inv.type}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.bodyPart ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-48">
                      <p className="truncate" title={inv.notes ?? undefined}>{inv.notes ?? "—"}</p>
                    </td>
                    {!isRadiographer && (
                      <td className="px-4 py-3 text-muted-foreground">{inv.requestedByName ?? "—"}</td>
                    )}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status]}`}>
                        {STATUS_LABELS[inv.status]}
                      </span>
                      {inv.resultNotes && (
                        <p className="text-xs text-muted-foreground mt-1 max-w-48 truncate" title={inv.resultNotes}>
                          {inv.resultNotes}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(inv.createdAt).toLocaleString("en-IN", {
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                      })}
                    </td>
                    {isRadiographer && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {inv.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleMarkInProgress(inv)}
                              disabled={updateMutation.isPending}
                            >
                              Start
                            </Button>
                          )}
                          {(inv.status === "pending" || inv.status === "in_progress") && (
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => openComplete(inv)}
                              disabled={updateMutation.isPending}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Complete
                            </Button>
                          )}
                          {inv.status === "completed" && (
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">Done</span>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Complete dialog */}
      <Dialog
        open={completeDialog.open}
        onOpenChange={open => setCompleteDialog(prev => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Mark Investigation Complete
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {completeDialog.inv && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
                <p><span className="font-medium">Patient:</span> {completeDialog.inv.patientName}</p>
                <p><span className="font-medium">Type:</span> {completeDialog.inv.type}
                  {completeDialog.inv.bodyPart ? ` — ${completeDialog.inv.bodyPart}` : ""}
                </p>
                {completeDialog.inv.notes && (
                  <p><span className="font-medium">Notes:</span> {completeDialog.inv.notes}</p>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Result Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                value={resultNotes}
                onChange={e => setResultNotes(e.target.value)}
                placeholder="Describe findings, attach report reference, or leave blank..."
                rows={4}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialog({ open: false, inv: null })}>
              Cancel
            </Button>
            <Button onClick={handleMarkComplete} disabled={updateMutation.isPending}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
