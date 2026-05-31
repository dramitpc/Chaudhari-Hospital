import { useState, useRef } from "react";
import {
  useListInvestigations,
  useUpdateInvestigation,
  getListInvestigationsQueryKey,
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
import { CheckCircle, Clock, ScanLine, AlertCircle, Filter, Paperclip, X, ImageIcon, FileText } from "lucide-react";
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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isPdf(dataUrl: string) {
  return dataUrl.startsWith("data:application/pdf");
}

function openInNewTab(dataUrl: string) {
  const win = window.open();
  if (win) {
    win.document.write(
      `<iframe src="${dataUrl}" style="width:100%;height:100%;border:none;margin:0;padding:0" />`
    );
    win.document.close();
  }
}

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

  // ── Complete dialog ───────────────────────────────────────────────────────
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
        data: {
          status: "completed",
          resultNotes: resultNotes || undefined,
        },
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

  // ── Image attachment ──────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [attachingLoading, setAttachingLoading] = useState(false);

  const [imagePreview, setImagePreview] = useState<{ open: boolean; src: string; label: string }>({
    open: false, src: "", label: ""
  });

  const triggerAttach = (inv: Investigation) => {
    setAttachingId(inv.id);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !attachingId) return;

    const isImage = file.type.startsWith("image/");
    const isPdfFile = file.type === "application/pdf";
    if (!isImage && !isPdfFile) {
      toast({ title: "Please select an image or PDF file", variant: "destructive" });
      e.target.value = "";
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "File must be under 8 MB", variant: "destructive" });
      e.target.value = "";
      return;
    }

    setAttachingLoading(true);
    try {
      const base64 = await fileToBase64(file);
      await updateMutation.mutateAsync({
        id: attachingId,
        data: { imageAttachment: base64 },
      });
      toast({ title: isPdfFile ? "PDF attached" : "Image attached" });
      queryClient.invalidateQueries({ queryKey: getListInvestigationsQueryKey(params) });
    } catch {
      toast({ title: "Failed to attach image", variant: "destructive" });
    } finally {
      setAttachingLoading(false);
      setAttachingId(null);
      e.target.value = "";
    }
  };

  const handleRemoveImage = (inv: Investigation) => {
    updateMutation.mutate(
      { id: inv.id, data: { imageAttachment: "" } },
      {
        onSuccess: () => {
          toast({ title: "Image removed" });
          queryClient.invalidateQueries({ queryKey: getListInvestigationsQueryKey(params) });
        },
      }
    );
  };
  // ─────────────────────────────────────────────────────────────────────────

  const investigations = data?.data ?? [];
  const pendingCount = investigations.filter(i => i.status === "pending").length;
  const inProgressCount = investigations.filter(i => i.status === "in_progress").length;

  return (
    <div className="space-y-6">
      {/* Hidden file input — shared, triggered imperatively */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
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
              ? "Radiography job queue — attach scan images and mark jobs complete"
              : "Investigation orders for your patients"}
          </p>
        </div>
      </div>

      {/* Summary cards */}
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
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Attachment</th>
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
                    <td className="px-4 py-3 text-muted-foreground max-w-40">
                      <p className="truncate" title={inv.notes ?? undefined}>{inv.notes ?? "—"}</p>
                    </td>
                    {!isRadiographer && (
                      <td className="px-4 py-3 text-muted-foreground">{inv.requestedByName ?? "—"}</td>
                    )}

                    {/* Attachment cell */}
                    <td className="px-4 py-3">
                      {inv.imageAttachment ? (
                        <div className="flex items-center gap-1.5">
                          {isPdf(inv.imageAttachment) ? (
                            <button
                              onClick={() => openInNewTab(inv.imageAttachment!)}
                              className="flex items-center gap-1 rounded border border-border bg-red-50 dark:bg-red-950/30 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400 hover:ring-2 hover:ring-red-400 transition"
                              title="Open PDF"
                            >
                              <FileText className="h-3.5 w-3.5 shrink-0" />
                              PDF
                            </button>
                          ) : (
                            <button
                              onClick={() => setImagePreview({ open: true, src: inv.imageAttachment!, label: `${inv.type}${inv.bodyPart ? ` — ${inv.bodyPart}` : ""}` })}
                              className="block rounded overflow-hidden border border-border hover:ring-2 hover:ring-primary transition shrink-0"
                              title="Click to view full image"
                            >
                              <img
                                src={inv.imageAttachment}
                                alt="Scan"
                                className="h-10 w-10 object-cover"
                              />
                            </button>
                          )}
                          {isRadiographer && inv.status !== "completed" && (
                            <button
                              onClick={() => handleRemoveImage(inv)}
                              className="text-muted-foreground hover:text-destructive transition"
                              title="Remove attachment"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
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
                      {new Date(inv.createdAt).toLocaleString("en-IN", {
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                      })}
                    </td>

                    {/* Actions — radiographer only */}
                    {isRadiographer && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end items-center gap-1">
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
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1"
                                onClick={() => triggerAttach(inv)}
                                disabled={attachingLoading && attachingId === inv.id}
                                title="Attach scan image"
                              >
                                {attachingLoading && attachingId === inv.id ? (
                                  <span className="animate-pulse">Uploading…</span>
                                ) : (
                                  <>
                                    <Paperclip className="h-3 w-3" />
                                    {inv.imageAttachment ? "Replace" : "Attach File"}
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs"
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
                <p>
                  <span className="font-medium">Type:</span> {completeDialog.inv.type}
                  {completeDialog.inv.bodyPart ? ` — ${completeDialog.inv.bodyPart}` : ""}
                </p>
                {completeDialog.inv.notes && (
                  <p><span className="font-medium">Notes:</span> {completeDialog.inv.notes}</p>
                )}
              </div>
            )}

            {/* Attached file preview inside complete dialog */}
            {completeDialog.inv?.imageAttachment && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {isPdf(completeDialog.inv.imageAttachment)
                    ? <><FileText className="h-3.5 w-3.5" /> Attached PDF Report</>
                    : <><ImageIcon className="h-3.5 w-3.5" /> Attached Scan Image</>
                  }
                </Label>
                {isPdf(completeDialog.inv.imageAttachment) ? (
                  <button
                    onClick={() => openInNewTab(completeDialog.inv!.imageAttachment!)}
                    className="flex items-center gap-2 w-full rounded-lg border border-border bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400 hover:ring-2 hover:ring-red-400 transition"
                  >
                    <FileText className="h-5 w-5 shrink-0" />
                    Open PDF in new tab
                  </button>
                ) : (
                  <button
                    onClick={() => setImagePreview({
                      open: true,
                      src: completeDialog.inv!.imageAttachment!,
                      label: `${completeDialog.inv!.type}${completeDialog.inv!.bodyPart ? ` — ${completeDialog.inv!.bodyPart}` : ""}`
                    })}
                    className="block rounded-lg overflow-hidden border border-border hover:ring-2 hover:ring-primary transition w-full"
                    title="Click to view full image"
                  >
                    <img
                      src={completeDialog.inv.imageAttachment}
                      alt="Attached scan"
                      className="w-full max-h-48 object-contain bg-black/5"
                    />
                  </button>
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
                autoFocus={!completeDialog.inv?.imageAttachment}
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
