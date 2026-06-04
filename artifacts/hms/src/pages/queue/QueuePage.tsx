import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useGetQueue, useCallNextPatient, useUpdateTokenStatus, useGenerateToken,
  useCreateConsultation, useListDoctors, useListPatients, useRegisterPatient,
  useListInvoices, useRecordPayment,
  getGetQueueQueryKey, getListDoctorsQueryKey, getListPatientsQueryKey, getListInvoicesQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { PlusCircle, ChevronRight, RefreshCw, Receipt, DollarSign } from "lucide-react";

const statusColors: Record<string, string> = {
  waiting: "border-amber-400 bg-amber-50 dark:bg-amber-900/20",
  called: "border-blue-400 bg-blue-50 dark:bg-blue-900/20",
  in_consultation: "border-green-400 bg-green-50 dark:bg-green-900/20",
  completed: "border-gray-300 bg-gray-50 dark:bg-gray-800/30 opacity-60",
  skipped: "border-gray-300 bg-gray-50 dark:bg-gray-800/30 opacity-60",
  cancelled: "border-red-300 bg-red-50 dark:bg-red-900/20 opacity-60",
};

const statusBadgeColors: Record<string, string> = {
  waiting: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  called: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  in_consultation: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  completed: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  skipped: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

function formatExpectedTime(estimatedWaitMinutes: number): string {
  const d = new Date(Date.now() + estimatedWaitMinutes * 60 * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

function WaitInfo({ estimatedWaitMinutes }: { estimatedWaitMinutes: number | null | undefined }) {
  if (estimatedWaitMinutes == null) return null;
  const isNext = estimatedWaitMinutes === 0;
  return (
    <div className="mt-1 space-y-0.5">
      <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
        {isNext ? "Next in Queue" : `Estimated Wait: ${estimatedWaitMinutes} mins`}
      </p>
      <p className="text-xs text-muted-foreground">
        Expected Consultation: {formatExpectedTime(estimatedWaitMinutes)}
      </p>
    </div>
  );
}

function VisitTypeBadge({ visitType }: { visitType?: string | null }) {
  if (visitType === "followup") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
        Follow-up
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
      New
    </span>
  );
}

type VisitTypeFilter = "" | "new" | "followup";

export default function QueuePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [visitTypeFilter, setVisitTypeFilter] = useState<VisitTypeFilter>("");
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenPatientId, setTokenPatientId] = useState("");
  const [tokenVisitType, setTokenVisitType] = useState<"new" | "followup">("new");

  const { data: doctorsData } = useListDoctors({ query: { queryKey: getListDoctorsQueryKey() } });
  const doctors = doctorsData?.data ?? [];

  useEffect(() => {
    if (!selectedDoctorId && doctors.length > 0) {
      const myDoctor = user?.role === "doctor" ? doctors.find(d => d.id === user?.id) : null;
      setSelectedDoctorId(myDoctor?.id ?? doctors[0]?.id ?? "");
    }
  }, [doctors, user, selectedDoctorId]);

  // Use the browser's local date so UTC offset (e.g. IST +5:30) doesn't shift the day
  const localToday = new Date().toLocaleDateString("en-CA"); // → "YYYY-MM-DD" in local tz

  const { data: queueData, isLoading, refetch } = useGetQueue(
    { doctorId: selectedDoctorId || undefined, date: localToday },
    { query: { enabled: !!selectedDoctorId, queryKey: getGetQueueQueryKey({ doctorId: selectedDoctorId || undefined, date: localToday }) } }
  );

  const { data: patients } = useListPatients({ limit: 200 }, { query: { queryKey: getListPatientsQueryKey({ limit: 200 }) } });

  const callNextMutation = useCallNextPatient();
  const updateStatusMutation = useUpdateTokenStatus();
  const generateTokenMutation = useGenerateToken();
  const createConsultationMutation = useCreateConsultation();
  const recordQueuePaymentMutation = useRecordPayment();
  const registerPatientMutation = useRegisterPatient();

  // "Register New Patient" inline state
  const [dialogMode, setDialogMode] = useState<"existing" | "new">("existing");
  const [newName, setNewName] = useState("");
  const [newGender, setNewGender] = useState<"male" | "female" | "other" | "">("");
  const [newPhone, setNewPhone] = useState("");
  const [newAge, setNewAge] = useState("");
  const [newDob, setNewDob] = useState("");

  // Read invoice-created flags from sessionStorage (set by ConsultationDetailPage after creating an invoice)
  const [invoicedPatientIds] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem("clinicos_inv_created");
      return new Set<string>(stored ? JSON.parse(stored) : []);
    } catch { return new Set<string>(); }
  });

  // Payment dialog state
  const [paymentPatientId, setPaymentPatientId] = useState<string | null>(null);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string>("");
  const [queuePayAmount, setQueuePayAmount] = useState("");
  const [queuePayMode, setQueuePayMode] = useState<"cash" | "card" | "upi" | "insurance">("cash");
  const [queuePayRef, setQueuePayRef] = useState("");

  const { data: patientInvoicesData } = useListInvoices(
    { patientId: paymentPatientId ?? "", limit: 20 },
    { query: { enabled: !!paymentPatientId, queryKey: getListInvoicesQueryKey({ patientId: paymentPatientId ?? "", limit: 20 }) } }
  );
  const patientInvoices = (patientInvoicesData?.data ?? []).filter(
    inv => (inv.balance ?? 0) > 0 && inv.status !== "cancelled" && inv.status !== "refunded"
  );

  const openQueuePayment = (patientId: string) => {
    setPaymentPatientId(patientId);
    setPaymentInvoiceId("");
    setQueuePayAmount("");
    setQueuePayMode("cash");
    setQueuePayRef("");
  };

  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getGetQueueQueryKey({ doctorId: selectedDoctorId || undefined, date: localToday }) });
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedDoctorId, localToday, queryClient]);

  const handleCallNext = () => {
    if (!selectedDoctorId) return;
    callNextMutation.mutate({ data: { doctorId: selectedDoctorId } }, {
      onSuccess: (token) => {
        toast({ title: `Calling Token #${token.tokenNumber}`, description: token.patientName });
        queryClient.invalidateQueries({ queryKey: getGetQueueQueryKey() });
      },
      onError: () => toast({ title: "No patients waiting", variant: "destructive" }),
    });
  };

  const handleUpdateStatus = (id: string, status: string) => {
    updateStatusMutation.mutate({ id, data: { status: status as "waiting" | "called" | "in_consultation" | "completed" | "skipped" | "cancelled" } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetQueueQueryKey() }),
    });
  };

  const handleStartConsultation = (tokenId: string, patientId: string, doctorId: string) => {
    updateStatusMutation.mutate(
      { id: tokenId, data: { status: "in_consultation" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetQueueQueryKey() });
          createConsultationMutation.mutate(
            { data: { patientId, doctorId, tokenId } },
            {
              onSuccess: (consultation) => { navigate(`/consultations/${consultation.id}`); },
              onError: () => toast({ title: "Error", description: "Failed to create consultation", variant: "destructive" }),
            }
          );
        },
        onError: () => toast({ title: "Error", description: "Failed to update token status", variant: "destructive" }),
      }
    );
  };

  const resetTokenModal = () => {
    setShowTokenModal(false);
    setTokenPatientId("");
    setTokenVisitType("new");
    setDialogMode("existing");
    setNewName("");
    setNewGender("");
    setNewPhone("");
    setNewAge("");
    setNewDob("");
  };

  const handleGenerateToken = () => {
    if (!tokenPatientId || !selectedDoctorId) return;
    generateTokenMutation.mutate(
      { data: { patientId: tokenPatientId, doctorId: selectedDoctorId, visitType: tokenVisitType, date: localToday } },
      {
        onSuccess: (token) => {
          toast({
            title: `Token #${token.tokenNumber} generated`,
            description: `${token.patientName} — ${tokenVisitType === "followup" ? "Follow-up" : "New Visit"}`,
          });
          queryClient.invalidateQueries({ queryKey: getGetQueueQueryKey() });
          resetTokenModal();
        },
        onError: () => toast({ title: "Error", description: "Failed to generate token", variant: "destructive" }),
      }
    );
  };

  const handleRegisterAndQueue = () => {
    if (!newName || !newGender || !selectedDoctorId) return;
    registerPatientMutation.mutate(
      { data: { fullName: newName, gender: newGender, phone: newPhone || undefined, age: newAge || undefined, dateOfBirth: newDob || undefined } },
      {
        onSuccess: (patient) => {
          generateTokenMutation.mutate(
            { data: { patientId: patient.id, doctorId: selectedDoctorId, visitType: tokenVisitType, date: localToday } },
            {
              onSuccess: (token) => {
                toast({
                  title: `Token #${token.tokenNumber} generated`,
                  description: `${patient.fullName} registered & added to queue`,
                });
                queryClient.invalidateQueries({ queryKey: getGetQueueQueryKey() });
                queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey({ limit: 200 }) });
                resetTokenModal();
              },
              onError: () => toast({ title: "Registered but queue failed", description: "Patient was registered; add to queue manually.", variant: "destructive" }),
            }
          );
        },
        onError: () => toast({ title: "Failed to register patient", variant: "destructive" }),
      }
    );
  };

  const allTokens = queueData?.tokens ?? [];
  const tokens = visitTypeFilter ? allTokens.filter(t => t.visitType === visitTypeFilter) : allTokens;
  const waiting = tokens.filter(t => t.status === "waiting");
  const inConsultation = allTokens.find(t => t.status === "in_consultation" || t.status === "called");

  const newCount = allTokens.filter(t => t.status === "waiting" && t.visitType === "new").length;
  const followupCount = allTokens.filter(t => t.status === "waiting" && t.visitType === "followup").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">OPD Queue</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {" · "}Today only · Auto-refreshes every 30 seconds
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="btn-refresh-queue">
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" onClick={() => setShowTokenModal(true)} data-testid="btn-generate-token">
            <PlusCircle className="mr-2 h-4 w-4" />
            Generate Token
          </Button>
          <Button onClick={handleCallNext} disabled={callNextMutation.isPending || waiting.length === 0} data-testid="btn-call-next">
            <ChevronRight className="mr-2 h-4 w-4" />
            Call Next
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
          <SelectTrigger className="w-full sm:w-64" data-testid="select-doctor">
            <SelectValue placeholder="Select doctor" />
          </SelectTrigger>
          <SelectContent>
            {doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.fullName}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground hidden sm:inline">Auto-refreshes every 30 seconds</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">Waiting</p>
          <p className="text-3xl font-bold text-amber-600">{queueData?.totalWaiting ?? 0}</p>
          {(newCount > 0 || followupCount > 0) && (
            <div className="flex justify-center gap-2 mt-1.5">
              {newCount > 0 && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">{newCount} New</span>}
              {followupCount > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">{followupCount} Follow-up</span>}
            </div>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">Currently Serving</p>
          <p className="text-3xl font-bold text-green-600">{queueData?.currentlyServing ?? "-"}</p>
          {inConsultation && (
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <p className="text-xs text-muted-foreground">{inConsultation.patientName}</p>
              <VisitTypeBadge visitType={inConsultation.visitType} />
            </div>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">Avg Consult Time</p>
          <p className="text-3xl font-bold text-blue-600">
            {queueData?.avgConsultationDuration ?? "—"}
            {queueData?.avgConsultationDuration != null && <span className="text-base font-normal ml-1">min</span>}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {queueData?.avgConsultationDuration != null ? "rolling avg · last 10 patients" : "no data yet · using 8 min default"}
          </p>
        </div>
      </div>

      {/* Visit Type Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Filter:</span>
        {([
          { value: "" as VisitTypeFilter, label: "All Patients", count: allTokens.filter(t => t.status !== "completed" && t.status !== "cancelled" && t.status !== "skipped").length },
          { value: "new" as VisitTypeFilter, label: "New Visit", count: allTokens.filter(t => t.visitType === "new" && t.status !== "completed" && t.status !== "cancelled" && t.status !== "skipped").length },
          { value: "followup" as VisitTypeFilter, label: "Follow-up", count: allTokens.filter(t => t.visitType === "followup" && t.status !== "completed" && t.status !== "cancelled" && t.status !== "skipped").length },
        ] as const).map(opt => (
          <button
            key={opt.value}
            onClick={() => setVisitTypeFilter(opt.value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              visitTypeFilter === opt.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {opt.label}
            <span className={`text-xs rounded-full px-1.5 py-0.5 ${visitTypeFilter === opt.value ? "bg-white/20" : "bg-muted"}`}>
              {opt.count}
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : allTokens.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
          {visitTypeFilter ? `No ${visitTypeFilter === "new" ? "new visit" : "follow-up"} patients in queue today` : "No tokens generated today"}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Active tokens (waiting / called / in_consultation) */}
          {tokens.filter(t => t.status !== "completed" && t.status !== "cancelled" && t.status !== "skipped").length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground text-sm">
              All patients seen for today — no one currently waiting.
            </div>
          ) : (
            tokens.filter(t => t.status !== "completed" && t.status !== "cancelled" && t.status !== "skipped").map(token => (
              <div key={token.id} className={`rounded-lg border-2 p-3 sm:p-4 ${statusColors[token.status] ?? ""}`} data-testid={`token-${token.tokenNumber}`}>
                {/* Top row: token circle + patient info */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center border-2 border-current font-bold text-base sm:text-xl mt-0.5">
                    {token.tokenNumber}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-foreground">{token.patientName}</span>
                      <VisitTypeBadge visitType={token.visitType} />
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusBadgeColors[token.status] ?? ""}`}>
                        {token.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {token.patientPhone ?? "No phone"}
                    </p>
                    {token.status === "waiting" && (
                      <WaitInfo estimatedWaitMinutes={token.estimatedWaitMinutes} />
                    )}
                  </div>
                </div>
                {/* Action buttons — full-width row below on all sizes */}
                <div className="flex flex-wrap gap-2 mt-2.5 justify-end items-center">
                  {invoicedPatientIds.has(token.patientId) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-300 dark:border-green-700 animate-pulse">
                      <Receipt className="h-3 w-3" /> Invoice ✓
                    </span>
                  )}
                  {token.status === "waiting" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(token.id, "called")}>Call</Button>
                      <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(token.id, "skipped")}>Skip</Button>
                    </>
                  )}
                  {token.status === "called" && (
                    <Button
                      size="sm"
                      onClick={() => handleStartConsultation(token.id, token.patientId, token.doctorId)}
                      disabled={createConsultationMutation.isPending || updateStatusMutation.isPending}
                    >
                      Start
                    </Button>
                  )}
                  {token.status === "in_consultation" && (
                    <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(token.id, "completed")}>Complete</Button>
                  )}
                  <Button
                    size="sm" variant="outline"
                    className="text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800"
                    onClick={() => openQueuePayment(token.patientId)}
                  >
                    <DollarSign className="h-3.5 w-3.5 mr-1" />Pay
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/billing/new?patientId=${token.patientId}`)}>
                    <Receipt className="h-3.5 w-3.5 mr-1" />Invoice
                  </Button>
                </div>
              </div>
            ))
          )}

          {/* Completed / Skipped — today only (scoped by API to localToday) */}
          {allTokens.filter(t => t.status === "completed" || t.status === "skipped" || t.status === "cancelled").length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">
                Completed / Skipped today ({allTokens.filter(t => t.status === "completed" || t.status === "skipped" || t.status === "cancelled").length})
              </p>
              <div className="space-y-2">
                {allTokens.filter(t => t.status === "completed" || t.status === "skipped" || t.status === "cancelled").map(token => (
                  <div key={token.id} className={`rounded-lg border-2 p-3 flex items-center gap-3 ${statusColors[token.status] ?? ""}`}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center border font-semibold text-sm flex-shrink-0">
                      {token.tokenNumber}
                    </div>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-sm text-muted-foreground truncate">{token.patientName}</span>
                      <VisitTypeBadge visitType={token.visitType} />
                      {invoicedPatientIds.has(token.patientId) && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-300 dark:border-green-700">
                          <Receipt className="h-2.5 w-2.5" /> ₹
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 px-2 text-xs text-green-700 hover:bg-green-50 dark:text-green-400 flex-shrink-0"
                      onClick={() => openQueuePayment(token.patientId)}
                    >
                      <DollarSign className="h-3 w-3 mr-0.5" />Pay
                    </Button>
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${statusBadgeColors[token.status] ?? ""}`}>
                      {token.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Record Payment Dialog ──────────────────────────────────────────── */}
      <Dialog open={!!paymentPatientId} onOpenChange={(open) => !open && setPaymentPatientId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              Record Payment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {!patientInvoicesData ? (
              <div className="space-y-2 py-2">
                <div className="h-8 bg-muted animate-pulse rounded" />
                <div className="h-8 bg-muted animate-pulse rounded" />
              </div>
            ) : patientInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No unpaid invoices found for this patient.</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Invoice <span className="text-destructive">*</span></Label>
                  <Select
                    value={paymentInvoiceId}
                    onValueChange={(v) => {
                      setPaymentInvoiceId(v);
                      const inv = patientInvoices.find(i => i.id === v);
                      if (inv?.balance != null) setQueuePayAmount(String(Math.max(0, inv.balance)));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select invoice" />
                    </SelectTrigger>
                    <SelectContent>
                      {patientInvoices.map(inv => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.invoiceNumber} — ₹{(inv.balance ?? 0).toFixed(2)} due
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Amount (₹) <span className="text-destructive">*</span></Label>
                  <Input
                    type="number" min="0" step="0.01"
                    value={queuePayAmount}
                    onChange={e => setQueuePayAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Payment Mode <span className="text-destructive">*</span></Label>
                  <Select value={queuePayMode} onValueChange={v => setQueuePayMode(v as "cash" | "card" | "upi" | "insurance")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="insurance">Insurance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Transaction Reference</Label>
                  <Input
                    value={queuePayRef}
                    onChange={e => setQueuePayRef(e.target.value)}
                    placeholder="UTR / transaction ID (optional)"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentPatientId(null)}>Cancel</Button>
            {patientInvoices.length > 0 && (
              <Button
                disabled={!paymentInvoiceId || !queuePayAmount || recordQueuePaymentMutation.isPending}
                onClick={() => {
                  if (!paymentInvoiceId || !queuePayAmount) return;
                  recordQueuePaymentMutation.mutate(
                    { id: paymentInvoiceId, data: { amount: +queuePayAmount, paymentMode: queuePayMode, transactionReference: queuePayRef || undefined } },
                    {
                      onSuccess: () => {
                        toast({ title: "Payment recorded" });
                        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey({ patientId: paymentPatientId ?? "", limit: 20 }) });
                        setPaymentPatientId(null);
                      },
                      onError: () => toast({ title: "Failed to record payment", variant: "destructive" }),
                    }
                  );
                }}
              >
                Record Payment
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Token Modal */}
      <Dialog open={showTokenModal} onOpenChange={(open) => { if (!open) resetTokenModal(); else setShowTokenModal(true); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Queue Token</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Mode toggle */}
            <div className="grid grid-cols-2 rounded-lg border border-border overflow-hidden text-sm font-medium">
              <button
                type="button"
                onClick={() => setDialogMode("existing")}
                className={`py-2 transition-colors ${dialogMode === "existing" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                Existing Patient
              </button>
              <button
                type="button"
                onClick={() => setDialogMode("new")}
                className={`py-2 transition-colors ${dialogMode === "new" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                + Register New
              </button>
            </div>

            {dialogMode === "existing" ? (
              <div className="space-y-1.5">
                <Label>Patient <span className="text-destructive">*</span></Label>
                <Select onValueChange={setTokenPatientId} value={tokenPatientId}>
                  <SelectTrigger data-testid="select-token-patient">
                    <SelectValue placeholder="Select patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {(patients?.data ?? []).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.fullName} ({p.patientId})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border border-dashed border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">New Patient Details</p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Full Name <span className="text-destructive">*</span></Label>
                  <Input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Patient full name"
                    data-testid="input-new-patient-name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Gender <span className="text-destructive">*</span></Label>
                    <Select onValueChange={v => setNewGender(v as "male" | "female" | "other")} value={newGender}>
                      <SelectTrigger data-testid="select-new-patient-gender">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Age (years)</Label>
                    <Input
                      type="number" min="0" max="150"
                      value={newAge}
                      onChange={e => setNewAge(e.target.value)}
                      placeholder="e.g. 35"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Phone</Label>
                    <Input
                      value={newPhone}
                      onChange={e => setNewPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Date of Birth</Label>
                    <Input
                      type="date"
                      value={newDob}
                      onChange={e => setNewDob(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Visit Type */}
            <div className="space-y-1.5">
              <Label>
                Visit Type <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTokenVisitType("new")}
                  className={`flex flex-col items-center justify-center rounded-lg border-2 p-3 text-sm font-medium transition-all ${
                    tokenVisitType === "new"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : "border-border hover:border-muted-foreground/40 text-muted-foreground"
                  }`}
                  data-testid="btn-visit-type-new"
                >
                  <span className="text-lg mb-0.5">🆕</span>
                  <span>New Visit</span>
                  <span className="text-xs font-normal opacity-70 mt-0.5">First time / new issue</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTokenVisitType("followup")}
                  className={`flex flex-col items-center justify-center rounded-lg border-2 p-3 text-sm font-medium transition-all ${
                    tokenVisitType === "followup"
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      : "border-border hover:border-muted-foreground/40 text-muted-foreground"
                  }`}
                  data-testid="btn-visit-type-followup"
                >
                  <span className="text-lg mb-0.5">🔄</span>
                  <span>Follow-up</span>
                  <span className="text-xs font-normal opacity-70 mt-0.5">Returning patient</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={resetTokenModal}>Cancel</Button>
              {dialogMode === "existing" ? (
                <Button
                  onClick={handleGenerateToken}
                  disabled={!tokenPatientId || generateTokenMutation.isPending}
                  data-testid="btn-confirm-generate-token"
                >
                  Generate Token
                </Button>
              ) : (
                <Button
                  onClick={handleRegisterAndQueue}
                  disabled={!newName || !newGender || registerPatientMutation.isPending || generateTokenMutation.isPending}
                  data-testid="btn-register-and-queue"
                >
                  {registerPatientMutation.isPending || generateTokenMutation.isPending ? "Registering…" : "Register & Generate Token"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
