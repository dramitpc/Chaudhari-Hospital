import { useState, useEffect } from "react";
import { useDebounce } from "../../hooks/useDebounce";
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
import { PlusCircle, ChevronLeft, ChevronRight, CalendarDays, X, RefreshCw, Receipt, DollarSign, Pencil } from "lucide-react";

function composeAgeString(y: string, m: string, d: string): string {
  const parts: string[] = [];
  if (parseInt(y) > 0) parts.push(`${parseInt(y)}y`);
  if (parseInt(m) > 0) parts.push(`${parseInt(m)}m`);
  if (parseInt(d) > 0) parts.push(`${parseInt(d)}d`);
  return parts.join(" ");
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

function fmtQueueDate(iso: string, today: string): string {
  if (iso === today) return "Today";
  if (iso === shiftDate(today, -1)) return "Yesterday";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const statusColors: Record<string, string> = {
  waiting: "border-amber-400 bg-amber-50 dark:bg-amber-900/20",
  called: "border-blue-400 bg-blue-50 dark:bg-blue-900/20",
  in_consultation: "border-green-400 bg-green-50 dark:bg-green-900/20",
  consultation_done: "border-purple-400 bg-purple-50 dark:bg-purple-900/20",
  completed: "border-gray-300 bg-gray-50 dark:bg-gray-800/30 opacity-60",
  skipped: "border-gray-300 bg-gray-50 dark:bg-gray-800/30 opacity-60",
  cancelled: "border-red-300 bg-red-50 dark:bg-red-900/20 opacity-60",
};

const statusBadgeColors: Record<string, string> = {
  waiting: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  called: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  in_consultation: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  consultation_done: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
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
  const localToday = new Date().toLocaleDateString("en-CA");
  const localYesterday = shiftDate(localToday, -1);
  const [selectedDate, setSelectedDate] = useState(localToday);
  const isToday = selectedDate === localToday;
  const isServable = isToday || selectedDate === localYesterday; // today + yesterday can be acted on
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenPatientId, setTokenPatientId] = useState("");
  const [tokenVisitType, setTokenVisitType] = useState<"new" | "followup">("new");
  const [patientSearch, setPatientSearch] = useState("");
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const [selectedPatientObj, setSelectedPatientObj] = useState<{ id: string; salutation?: string | null; fullName: string; patientId: string; phone?: string | null } | null>(null);
  const debouncedPatientSearch = useDebounce(patientSearch, 300);

  const { data: doctorsData } = useListDoctors({ query: { queryKey: getListDoctorsQueryKey() } });
  const doctors = doctorsData?.data ?? [];

  useEffect(() => {
    if (!selectedDoctorId && doctors.length > 0) {
      const myDoctor = user?.role === "doctor" ? doctors.find(d => d.id === user?.id) : null;
      setSelectedDoctorId(myDoctor?.id ?? doctors[0]?.id ?? "");
    }
  }, [doctors, user, selectedDoctorId]);

  const { data: queueData, isLoading, refetch } = useGetQueue(
    { doctorId: selectedDoctorId || undefined, date: selectedDate },
    { query: { enabled: !!selectedDoctorId, queryKey: getGetQueueQueryKey({ doctorId: selectedDoctorId || undefined, date: selectedDate }) } }
  );

  const { data: patients } = useListPatients(
    { search: debouncedPatientSearch || undefined, limit: 50 },
    { query: { queryKey: getListPatientsQueryKey({ search: debouncedPatientSearch || undefined, limit: 50 }) } }
  );

  const callNextMutation = useCallNextPatient();
  const updateStatusMutation = useUpdateTokenStatus();
  const generateTokenMutation = useGenerateToken();
  const createConsultationMutation = useCreateConsultation();
  const recordQueuePaymentMutation = useRecordPayment();
  const registerPatientMutation = useRegisterPatient();

  // "Register New Patient" inline state
  const [dialogMode, setDialogMode] = useState<"existing" | "new">("existing");
  const [newSalutation, setNewSalutation] = useState("");
  const [newName, setNewName] = useState("");
  const [newGender, setNewGender] = useState<"male" | "female" | "other" | "">("");
  const [newPhone, setNewPhone] = useState("");
  const [newAgeYears, setNewAgeYears] = useState("");
  const [newAgeMonths, setNewAgeMonths] = useState("");
  const [newAgeDays, setNewAgeDays] = useState("");
  const [newAddress, setNewAddress] = useState("");

  // Read invoice-created flags from sessionStorage (set by ConsultationDetailPage after creating an invoice)
  const [invoicedPatientIds] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem("clinicos_inv_created");
      return new Set<string>(stored ? JSON.parse(stored) : []);
    } catch { return new Set<string>(); }
  });

  // Fetch all pending/partial invoices to know which patients owe money
  const { data: pendingInvoicesData } = useListInvoices(
    { status: "pending", limit: 500 },
    { query: { queryKey: getListInvoicesQueryKey({ status: "pending", limit: 500 }) } }
  );
  const { data: partialInvoicesData } = useListInvoices(
    { status: "partial", limit: 500 },
    { query: { queryKey: getListInvoicesQueryKey({ status: "partial", limit: 500 }) } }
  );
  const pendingPatientIds = new Set<string>([
    ...(pendingInvoicesData?.data ?? []).map(inv => inv.patientId),
    ...(partialInvoicesData?.data ?? []).map(inv => inv.patientId),
  ]);

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

  // Complete Visit confirmation
  const [completeVisitTarget, setCompleteVisitTarget] = useState<{ tokenId: string; patientId: string } | null>(null);
  const { data: completeVisitInvoicesData, isLoading: completeVisitInvoicesLoading } = useListInvoices(
    { patientId: completeVisitTarget?.patientId ?? "", limit: 20 },
    { query: { enabled: !!completeVisitTarget, queryKey: getListInvoicesQueryKey({ patientId: completeVisitTarget?.patientId ?? "", limit: 20 }) } }
  );
  const completeVisitPendingInvoices = (completeVisitInvoicesData?.data ?? []).filter(
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
    if (!isToday) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getGetQueueQueryKey({ doctorId: selectedDoctorId || undefined, date: selectedDate }) });
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedDoctorId, selectedDate, isToday, queryClient]);

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
    updateStatusMutation.mutate({ id, data: { status: status as "waiting" | "called" | "in_consultation" | "consultation_done" | "completed" | "skipped" | "cancelled" } }, {
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
    setPatientSearch("");
    setPatientDropdownOpen(false);
    setSelectedPatientObj(null);
    setNewSalutation("");
    setNewName("");
    setNewGender("");
    setNewPhone("");
    setNewAgeYears("");
    setNewAgeMonths("");
    setNewAgeDays("");
    setNewAddress("");
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
      { data: { salutation: newSalutation || undefined, fullName: newName, gender: newGender, phone: newPhone || undefined, age: composeAgeString(newAgeYears, newAgeMonths, newAgeDays) || undefined, address: newAddress || undefined } },
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
                queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
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
  const inConsultation = allTokens.find(t => t.status === "in_consultation" || t.status === "called" || t.status === "consultation_done");

  const newCount = allTokens.filter(t => t.status === "waiting" && t.visitType === "new").length;
  const followupCount = allTokens.filter(t => t.status === "waiting" && t.visitType === "followup").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">OPD Queue</h1>
          <p className="text-sm text-muted-foreground">
            {isToday ? "Today" : fmtQueueDate(selectedDate, localToday)}
            {isToday && " · Auto-refreshes every 30 seconds"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="btn-refresh-queue">
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          {isToday && (
            <Button variant="outline" onClick={() => setShowTokenModal(true)} data-testid="btn-generate-token">
              <PlusCircle className="mr-2 h-4 w-4" />
              Generate Token
            </Button>
          )}
          {isServable && (
            <Button onClick={handleCallNext} disabled={callNextMutation.isPending || waiting.length === 0} data-testid="btn-call-next">
              <ChevronRight className="mr-2 h-4 w-4" />
              Call Next
            </Button>
          )}
        </div>
      </div>

      {/* Doctor selector + Date picker */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
          <SelectTrigger className="w-full sm:w-64" data-testid="select-doctor">
            <SelectValue placeholder="Select doctor" />
          </SelectTrigger>
          <SelectContent>
            {doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.fullName}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Date picker */}
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
              max={localToday}
              onChange={e => { if (e.target.value) setSelectedDate(e.target.value); }}
              className="h-9 pl-8 pr-2 text-sm bg-transparent focus:outline-none min-w-[130px] cursor-pointer"
            />
          </div>
          <span className={`px-2 text-xs font-medium border-l border-border h-9 flex items-center ${isToday ? "text-primary" : "text-muted-foreground"}`}>
            {fmtQueueDate(selectedDate, localToday)}
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
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setSelectedDate(localToday)}>
            <X className="h-3.5 w-3.5" />Today
          </Button>
        )}
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
                      {token.patientAge && (
                        <span className="text-xs text-muted-foreground">{token.patientAge}{token.patientGender ? ` / ${token.patientGender}` : ""}</span>
                      )}
                      <VisitTypeBadge visitType={token.visitType} />
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusBadgeColors[token.status] ?? ""}`}>
                        {token.status.replace("_", " ")}
                      </span>
                      {(token.skippedCount ?? 0) > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                          ↩ Skipped {token.skippedCount}×
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {token.patientNumber && (
                        <span className="font-mono font-medium text-foreground/70 mr-1.5">{token.patientNumber}</span>
                      )}
                      {token.patientPhone ?? "No phone"}
                      <span className="mx-1.5 opacity-40">·</span>
                      <span title="Token generated at">🕐 {new Date(token.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </p>
                    {token.status === "waiting" && (
                      <WaitInfo estimatedWaitMinutes={token.estimatedWaitMinutes} />
                    )}
                  </div>
                </div>
                {/* Action buttons — full-width row below on all sizes */}
                <div className="flex flex-wrap gap-2 mt-2.5 justify-end items-center">
                  <Button
                    size="sm" variant="ghost"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => navigate(`/patients/${token.patientId}/edit?from=queue`)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />Edit Patient
                  </Button>
                  {isServable && token.status === "waiting" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(token.id, "called")}>Call</Button>
                      <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(token.id, "skipped")}>Skip</Button>
                    </>
                  )}
                  {isServable && token.status === "called" && (
                    <Button
                      size="sm"
                      onClick={() => handleStartConsultation(token.id, token.patientId, token.doctorId)}
                      disabled={createConsultationMutation.isPending || updateStatusMutation.isPending}
                    >
                      Start
                    </Button>
                  )}
                  {token.status === "in_consultation" && token.consultationId && (
                    <Button size="sm" variant="outline" onClick={() => navigate(`/consultations/${token.consultationId}`)}>
                      Open Consultation
                    </Button>
                  )}
                  {isServable && token.status === "consultation_done" && (
                    <Button
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                      onClick={() => setCompleteVisitTarget({ tokenId: token.id, patientId: token.patientId })}
                      disabled={updateStatusMutation.isPending}
                    >
                      Complete Visit
                    </Button>
                  )}
                  <Button
                    size="sm" variant="outline"
                    className="text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800"
                    onClick={() => openQueuePayment(token.patientId)}
                  >
                    <DollarSign className="h-3.5 w-3.5 mr-1" />Pay
                  </Button>
                  {pendingPatientIds.has(token.patientId) ? (
                    <Button
                      size="sm"
                      className="animate-pulse bg-orange-500 hover:bg-orange-600 text-white border-0"
                      onClick={() => navigate(`/billing/new?patientId=${token.patientId}&from=queue`)}
                    >
                      <Receipt className="h-3.5 w-3.5 mr-1" />Invoice Pending
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => navigate(`/billing/new?patientId=${token.patientId}&from=queue`)}>
                      <Receipt className="h-3.5 w-3.5 mr-1" />Invoice
                    </Button>
                  )}
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
                    <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
                      <span className="text-sm text-muted-foreground truncate">{token.patientName}</span>
                      {token.patientAge && <span className="text-xs text-muted-foreground shrink-0">{token.patientAge}{token.patientGender ? ` / ${token.patientGender}` : ""}</span>}
                      <VisitTypeBadge visitType={token.visitType} />
                      <span className="text-xs text-muted-foreground shrink-0">🕐 {new Date(token.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
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
                        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey({ status: "pending", limit: 500 }) });
                        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey({ status: "partial", limit: 500 }) });
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

      {/* ── Complete Visit Confirmation Dialog ─────────────────────────────── */}
      <Dialog open={!!completeVisitTarget} onOpenChange={(open) => { if (!open) setCompleteVisitTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Complete Visit
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {completeVisitInvoicesLoading ? (
              <div className="space-y-2 py-2">
                <div className="h-6 bg-muted animate-pulse rounded" />
                <div className="h-6 bg-muted animate-pulse rounded w-3/4" />
              </div>
            ) : completeVisitPendingInvoices.length > 0 ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-3 py-3 space-y-2">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  ⚠ Invoice Payment Pending
                </p>
                <ul className="space-y-1">
                  {completeVisitPendingInvoices.map(inv => (
                    <li key={inv.id} className="text-xs text-amber-700 dark:text-amber-400 flex justify-between">
                      <span>{inv.invoiceNumber}</span>
                      <span className="font-medium">₹{(inv.balance ?? 0).toFixed(2)} due</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-amber-700 dark:text-amber-400">Please clear the invoice before ending the visit.</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No pending invoices. Ready to complete the visit.</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCompleteVisitTarget(null)}>Cancel</Button>
            {completeVisitPendingInvoices.length > 0 && !completeVisitInvoicesLoading && (
              <Button
                variant="outline"
                className="text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400"
                onClick={() => {
                  if (completeVisitTarget) openQueuePayment(completeVisitTarget.patientId);
                  setCompleteVisitTarget(null);
                }}
              >
                <DollarSign className="h-3.5 w-3.5 mr-1" /> Pay Now
              </Button>
            )}
            <Button
              disabled={updateStatusMutation.isPending || completeVisitInvoicesLoading}
              className={completeVisitPendingInvoices.length > 0 ? "bg-amber-600 hover:bg-amber-700" : ""}
              onClick={() => {
                if (completeVisitTarget) {
                  handleUpdateStatus(completeVisitTarget.tokenId, "completed");
                  setCompleteVisitTarget(null);
                }
              }}
            >
              {completeVisitPendingInvoices.length > 0 ? "Complete Anyway" : "Complete Visit"}
            </Button>
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
                {(() => {
                  const allPatients = patients?.data ?? [];
                  const selected = selectedPatientObj;
                  return (
                    <div className="relative">
                      {selected && !patientDropdownOpen ? (
                        <div
                          className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            setPatientSearch("");
                            setPatientDropdownOpen(true);
                            setTokenPatientId("");
                            setSelectedPatientObj(null);
                          }}
                          data-testid="selected-patient-display"
                        >
                          <div>
                            <p className="text-sm font-medium">{[selected.salutation, selected.fullName].filter(Boolean).join(" ")}</p>
                            <p className="text-xs text-muted-foreground">{selected.patientId}{selected.phone ? ` · ${selected.phone}` : ""}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">change</span>
                        </div>
                      ) : (
                        <>
                          <Input
                            autoFocus
                            value={patientSearch}
                            onChange={e => { setPatientSearch(e.target.value); setPatientDropdownOpen(true); }}
                            onFocus={() => setPatientDropdownOpen(true)}
                            placeholder="Search by name, patient ID, or mobile…"
                            data-testid="input-patient-search"
                          />
                          {patientDropdownOpen && (
                            <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-52 overflow-y-auto">
                              {allPatients.length === 0 ? (
                                <p className="px-3 py-2 text-sm text-muted-foreground">{patientSearch ? "No patients found" : "Type to search…"}</p>
                              ) : (
                                allPatients.slice(0, 50).map(p => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    className="w-full text-left px-3 py-2 hover:bg-muted transition-colors"
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => {
                                      setTokenPatientId(p.id);
                                      setSelectedPatientObj(p);
                                      setPatientSearch("");
                                      setPatientDropdownOpen(false);
                                    }}
                                  >
                                    <p className="text-sm font-medium">{[p.salutation, p.fullName].filter(Boolean).join(" ")}</p>
                                    <p className="text-xs text-muted-foreground">{p.patientId}{p.phone ? ` · ${p.phone}` : ""}</p>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border border-dashed border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">New Patient Details</p>
                <div className="flex gap-2 items-start">
                  <div className="space-y-1.5 w-24 shrink-0">
                    <Label className="text-xs">Salutation</Label>
                    <Select onValueChange={v => {
                      setNewSalutation(v);
                      if (["Mr.", "Master"].includes(v)) setNewGender("male");
                      else if (["Mrs.", "Ms.", "Miss"].includes(v)) setNewGender("female");
                    }} value={newSalutation}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {["Mr.", "Mrs.", "Ms.", "Miss", "Dr.", "Master", "Baby", "Baby of"].map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <Label className="text-xs">Full Name <span className="text-destructive">*</span></Label>
                    <Input
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder="Patient full name"
                      data-testid="input-new-patient-name"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Address</Label>
                  <Input
                    type="text"
                    value={newAddress}
                    onChange={e => setNewAddress(e.target.value)}
                    placeholder="Street, City"
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
                    <Label className="text-xs">Phone</Label>
                    <Input
                      value={newPhone}
                      onChange={e => setNewPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Age</Label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Input type="number" min="0" max="150" value={newAgeYears} onChange={e => setNewAgeYears(e.target.value)} placeholder="0" className="pr-8 text-xs h-9" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">yr</span>
                    </div>
                    <div className="flex-1 relative">
                      <Input type="number" min="0" max="11" value={newAgeMonths} onChange={e => setNewAgeMonths(e.target.value)} placeholder="0" className="pr-8 text-xs h-9" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">mo</span>
                    </div>
                    <div className="flex-1 relative">
                      <Input type="number" min="0" max="31" value={newAgeDays} onChange={e => setNewAgeDays(e.target.value)} placeholder="0" className="pr-6 text-xs h-9" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">d</span>
                    </div>
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
