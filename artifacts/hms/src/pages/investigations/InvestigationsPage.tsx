import { useState, useRef } from "react";
import { fmtDateTime } from "@/lib/dateUtils";
import {
  useListInvestigations,
  useUpdateInvestigation,
  getListInvestigationsQueryKey,
  useListConsultations,
  getListConsultationsQueryKey,
  type Investigation,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle, Clock, ScanLine, AlertCircle, Filter,
  Paperclip, X, ImageIcon, FileText, ClipboardList,
} from "lucide-react";
import { Link } from "wouter";

const STATUS_COLORS: Record<string, string> = {
  pending:     "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  completed:   "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  cancelled:   "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  pending:     "Pending",
  in_progress: "In Progress",
  completed:   "Completed",
  cancelled:   "Cancelled",
};

// ── Attachment helpers ────────────────────────────────────────────────────────

type Attachment = { name: string; data: string };

/** Parse whatever is in the DB — handles the old single-base64 format too */
function parseAttachments(raw: string | null | undefined): Attachment[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Attachment[];
  } catch {}
  // backward-compat: plain base64 data-URL stored as a bare string
  return [{ name: "attachment", data: raw }];
}

function serializeAttachments(list: Attachment[]): string {
  return JSON.stringify(list);
}

function isPdf(dataUrl: string) {
  return dataUrl.startsWith("data:application/pdf");
}

function openInNewTab(dataUrl: string) {
  const win = window.open();
  if (win) {
    win.document.write(
      `<iframe src="${dataUrl}" style="width:100%;height:100%;border:none;margin:0;padding:0"/>`
    );
    win.document.close();
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Small components ──────────────────────────────────────────────────────────

function AttachmentChip({
  att,
  onRemove,
  onPreview,
}: {
  att: Attachment;
  onRemove?: () => void;
  onPreview: () => void;
}) {
  if (isPdf(att.data)) {
    return (
      <div className="flex items-center gap-1 rounded border border-border bg-red-50 dark:bg-red-950/30 pl-1.5 pr-1 py-0.5">
        <button
          onClick={() => openInNewTab(att.data)}
          className="flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400 hover:underline"
          title="Open PDF"
        >
          <FileText className="h-3 w-3 shrink-0" />
          {att.name.length > 16 ? att.name.slice(0, 14) + "…" : att.name}
        </button>
        {onRemove && (
          <button onClick={onRemove} className="text-muted-foreground hover:text-destructive ml-0.5" title="Remove">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="relative group shrink-0">
      <button
        onClick={onPreview}
        className="block rounded overflow-hidden border border-border hover:ring-2 hover:ring-primary transition"
        title={att.name}
      >
        <img src={att.data} alt={att.name} className="h-10 w-10 object-cover" />
      </button>
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center h-4 w-4 rounded-full bg-destructive text-white shadow"
          title="Remove"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function InvestigationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isRadiographer = user?.role === "radiographer";
  const [statusFilter, setStatusFilter] = useState<string>(isRadiographer ? "pending" : "all");

  const localToday = new Date().toLocaleDateString("en-CA");
  // Don't restrict by date for pending/in-progress — advised investigations may be from past days.
  // Apply date filter only when viewing completed/cancelled/all to keep the list manageable.
  const needsDateFilter = statusFilter === "all" || statusFilter === "completed" || statusFilter === "cancelled";
  const params = {
    ...(needsDateFilter ? { date: localToday } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter as Investigation["status"] } : {}),
  };
  const { data, isLoading } = useListInvestigations(params, {
    query: { queryKey: getListInvestigationsQueryKey(params), refetchInterval: 30000 },
  });

  // ── Consultation investigation orders ─────────────────────────────────────
  const consultParams = { date: localToday, limit: 100 };
  const { data: consultData } = useListConsultations(consultParams, {
    query: { queryKey: getListConsultationsQueryKey(consultParams), refetchInterval: 30000 },
  });
  const consultOrders = (consultData?.data ?? []).filter(c => c.investigationOrders?.trim());

  const updateMutation = useUpdateInvestigation();

  // ── Complete dialog ───────────────────────────────────────────────────────
  const [completeDialog, setCompleteDialog] = useState<{ open: boolean; inv: Investigation | null }>({
    open: false, inv: null,
  });
  const [resultNotes, setResultNotes] = useState("");

  const openComplete = (inv: Investigation) => {
    setCompleteDialog({ open: true, inv });
    setResultNotes("");
  };

  const handleMarkComplete = () => {
    if (!completeDialog.inv) return;
    updateMutation.mutate(
      { id: completeDialog.inv.id, data: { status: "completed", resultNotes: resultNotes || undefined } },
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

  // ── Attachment upload ─────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [attachingLoading, setAttachingLoading] = useState(false);

  const [imagePreview, setImagePreview] = useState<{ open: boolean; src: string; label: string }>({
    open: false, src: "", label: "",
  });

  const triggerAttach = (inv: Investigation) => {
    setAttachingId(inv.id);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !attachingId) return;

    const invalid = files.find(f => !f.type.startsWith("image/") && f.type !== "application/pdf");
    if (invalid) {
      toast({ title: "Only images and PDFs are allowed", variant: "destructive" });
      e.target.value = "";
      return;
    }

    const tooBig = files.find(f => f.size > 8 * 1024 * 1024);
    if (tooBig) {
      toast({ title: `${tooBig.name} exceeds the 8 MB limit`, variant: "destructive" });
      e.target.value = "";
      return;
    }

    setAttachingLoading(true);
    try {
      // Find the current investigation to append to existing attachments
      const currentInv = investigations.find(i => i.id === attachingId);
      const existing = parseAttachments(currentInv?.imageAttachment);

      const newEntries: Attachment[] = await Promise.all(
        files.map(async f => ({ name: f.name, data: await fileToBase64(f) }))
      );

      const merged = [...existing, ...newEntries];
      await updateMutation.mutateAsync({
        id: attachingId,
        data: { imageAttachment: serializeAttachments(merged) },
      });
      toast({ title: `${newEntries.length} file${newEntries.length > 1 ? "s" : ""} attached` });
      queryClient.invalidateQueries({ queryKey: getListInvestigationsQueryKey(params) });
    } catch {
      toast({ title: "Failed to attach files", variant: "destructive" });
    } finally {
      setAttachingLoading(false);
      setAttachingId(null);
      e.target.value = "";
    }
  };

  const handleRemoveAttachment = (inv: Investigation, idx: number) => {
    const list = parseAttachments(inv.imageAttachment);
    const updated = list.filter((_, i) => i !== idx);
    updateMutation.mutate(
      { id: inv.id, data: { imageAttachment: updated.length ? serializeAttachments(updated) : "" } },
      {
        onSuccess: () => {
          toast({ title: "Attachment removed" });
          queryClient.invalidateQueries({ queryKey: getListInvestigationsQueryKey(params) });
        },
      }
    );
  };
  // ─────────────────────────────────────────────────────────────────────────

  const investigations = data?.data ?? [];
  const pendingCount   = investigations.filter(i => i.status === "pending").length;
  const inProgressCount = investigations.filter(i => i.status === "in_progress").length;

  return (
    <div className="space-y-6">
      {/* Hidden file input — multiple files */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScanLine className="h-6 w-6 text-primary" />
            Investigations
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isRadiographer
              ? "Radiography job queue — attach scan files and mark jobs complete"
              : "Investigation orders for your patients"}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      {isRadiographer && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Pending",     value: pendingCount,    icon: Clock,        color: "text-amber-600" },
            { label: "In Progress", value: inProgressCount, icon: AlertCircle,  color: "text-blue-600"  },
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

      {/* Consultation investigation orders for today */}
      {consultOrders.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
            <ClipboardList className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">Investigation Orders from Today's Consultations</h2>
            <span className="ml-auto text-xs text-muted-foreground">{consultOrders.length} consultation{consultOrders.length > 1 ? "s" : ""}</span>
          </div>
          <div className="divide-y divide-border">
            {consultOrders.map(c => (
              <div key={c.id} className="px-4 py-3 flex gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Link href={`/patients/${c.patientId}`}>
                      <span className="font-medium text-sm text-primary hover:underline cursor-pointer">
                        {c.patientName ?? c.patientId}
                      </span>
                    </Link>
                    {c.doctorName && (
                      <span className="text-xs text-muted-foreground">· {c.doctorName}</span>
                    )}
                    <Link href={`/consultations/${c.id}`}>
                      <span className="text-xs text-muted-foreground hover:underline cursor-pointer">View consultation →</span>
                    </Link>
                  </div>
                  <p className="text-sm whitespace-pre-wrap text-foreground">{c.investigationOrders}</p>
                </div>
              </div>
            ))}
          </div>
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
            {statusFilter === "all"
              ? "No investigations yet"
              : `No ${STATUS_LABELS[statusFilter]?.toLowerCase()} investigations`}
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
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Attachments</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Time</th>
                  {isRadiographer && (
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {investigations.map(inv => {
                  const attachments = parseAttachments(inv.imageAttachment);
                  const canEdit = isRadiographer && inv.status !== "completed";
                  return (
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
                      <td className="px-4 py-3 text-muted-foreground max-w-40">
                        <p className="truncate" title={inv.notes ?? undefined}>{inv.notes ?? "—"}</p>
                      </td>
                      {!isRadiographer && (
                        <td className="px-4 py-3 text-muted-foreground">{inv.requestedByName ?? "—"}</td>
                      )}

                      {/* Attachments cell */}
                      <td className="px-4 py-3">
                        {attachments.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 items-start max-w-44">
                            {attachments.map((att, idx) => (
                              <AttachmentChip
                                key={idx}
                                att={att}
                                onRemove={canEdit ? () => handleRemoveAttachment(inv, idx) : undefined}
                                onPreview={() =>
                                  !isPdf(att.data) &&
                                  setImagePreview({
                                    open: true,
                                    src: att.data,
                                    label: att.name,
                                  })
                                }
                              />
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status]}`}>
                          {STATUS_LABELS[inv.status]}
                        </span>
                        {inv.resultNotes && (
                          <p className="text-xs text-muted-foreground mt-1 max-w-40 truncate" title={inv.resultNotes}>
                            {inv.resultNotes}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDateTime(inv.createdAt)}
                      </td>

                      {/* Actions — radiographer only */}
                      {isRadiographer && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end items-center gap-1">
                            {inv.status === "pending" && (
                              <Button
                                size="sm" variant="outline" className="h-7 text-xs"
                                onClick={() => handleMarkInProgress(inv)}
                                disabled={updateMutation.isPending}
                              >
                                Start
                              </Button>
                            )}
                            {canEdit && (
                              <>
                                <Button
                                  size="sm" variant="outline" className="h-7 text-xs gap-1"
                                  onClick={() => triggerAttach(inv)}
                                  disabled={attachingLoading && attachingId === inv.id}
                                  title="Attach images or PDFs"
                                >
                                  {attachingLoading && attachingId === inv.id ? (
                                    <span className="animate-pulse">Uploading…</span>
                                  ) : (
                                    <>
                                      <Paperclip className="h-3 w-3" />
                                      Attach
                                      {attachments.length > 0 && (
                                        <span className="ml-0.5 rounded-full bg-primary/20 text-primary px-1 text-[10px] font-semibold">
                                          {attachments.length}
                                        </span>
                                      )}
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="sm" className="h-7 text-xs"
                                  onClick={() => openComplete(inv)}
                                  disabled={updateMutation.isPending}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Complete
                                </Button>
                              </>
                            )}
                            {inv.status === "completed" && (
                              <span className="text-xs text-green-600 dark:text-green-400 font-medium">Done</span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Complete dialog */}
      <Dialog open={completeDialog.open} onOpenChange={open => setCompleteDialog(prev => ({ ...prev, open }))}>
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
                <p>
                  <span className="font-medium">Type:</span> {completeDialog.inv.type}
                  {completeDialog.inv.bodyPart ? ` — ${completeDialog.inv.bodyPart}` : ""}
                </p>
                {completeDialog.inv.notes && (
                  <p><span className="font-medium">Notes:</span> {completeDialog.inv.notes}</p>
                )}
              </div>
            )}

            {/* Attachments preview inside complete dialog */}
            {(() => {
              const atts = parseAttachments(completeDialog.inv?.imageAttachment);
              if (!atts.length) return null;
              return (
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Paperclip className="h-3.5 w-3.5" />
                    {atts.length} attachment{atts.length > 1 ? "s" : ""}
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {atts.map((att, idx) => (
                      <div key={idx}>
                        {isPdf(att.data) ? (
                          <button
                            onClick={() => openInNewTab(att.data)}
                            className="flex items-center gap-1.5 rounded-lg border border-border bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-400 hover:ring-2 hover:ring-red-400 transition"
                          >
                            <FileText className="h-4 w-4 shrink-0" />
                            {att.name.length > 20 ? att.name.slice(0, 18) + "…" : att.name}
                          </button>
                        ) : (
                          <button
                            onClick={() => setImagePreview({ open: true, src: att.data, label: att.name })}
                            className="block rounded-lg overflow-hidden border border-border hover:ring-2 hover:ring-primary transition"
                            title={att.name}
                          >
                            <img src={att.data} alt={att.name} className="h-20 w-20 object-cover" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="space-y-1.5">
              <Label>Result Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                value={resultNotes}
                onChange={e => setResultNotes(e.target.value)}
                placeholder="Describe findings, attach report reference, or leave blank..."
                rows={4}
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

      {/* Full-size image preview dialog */}
      <Dialog open={imagePreview.open} onOpenChange={open => setImagePreview(p => ({ ...p, open }))}>
        <DialogContent className="max-w-3xl p-2">
          <DialogHeader className="px-3 pt-2 pb-0">
            <DialogTitle className="flex items-center gap-2 text-sm font-medium">
              <ImageIcon className="h-4 w-4" />
              {imagePreview.label}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 rounded-lg overflow-hidden bg-black/10 dark:bg-black/40">
            <img
              src={imagePreview.src}
              alt={imagePreview.label}
              className="w-full max-h-[75vh] object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
