import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useGetQueue, useCallNextPatient, useUpdateTokenStatus, useGenerateToken,
  useCreateConsultation, useListUsers, useListPatients,
  getGetQueueQueryKey, getListUsersQueryKey, getListPatientsQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { PlusCircle, ChevronRight, RefreshCw, Receipt } from "lucide-react";

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

export default function QueuePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenPatientId, setTokenPatientId] = useState("");

  const { data: users } = useListUsers({ role: "doctor" }, { query: { queryKey: getListUsersQueryKey({ role: "doctor" }) } });
  const doctors = users?.data ?? [];

  useEffect(() => {
    if (!selectedDoctorId && doctors.length > 0) {
      const myDoctor = user?.role === "doctor" ? doctors.find(d => d.id === user?.id) : null;
      setSelectedDoctorId(myDoctor?.id ?? doctors[0]?.id ?? "");
    }
  }, [doctors, user, selectedDoctorId]);

  const { data: queueData, isLoading, refetch } = useGetQueue(
    { doctorId: selectedDoctorId || undefined },
    { query: { enabled: !!selectedDoctorId, queryKey: getGetQueueQueryKey({ doctorId: selectedDoctorId || undefined }) } }
  );

  const { data: patients } = useListPatients({ limit: 200 }, { query: { queryKey: getListPatientsQueryKey({ limit: 200 }) } });

  const callNextMutation = useCallNextPatient();
  const updateStatusMutation = useUpdateTokenStatus();
  const generateTokenMutation = useGenerateToken();
  const createConsultationMutation = useCreateConsultation();

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getGetQueueQueryKey({ doctorId: selectedDoctorId || undefined }) });
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedDoctorId, queryClient]);

  const handleCallNext = () => {
    if (!selectedDoctorId) return;
    callNextMutation.mutate({ data: { doctorId: selectedDoctorId } }, {
      onSuccess: (token) => {
        toast({ title: `Calling Token #${token.tokenNumber}`, description: token.patientName });
        queryClient.invalidateQueries({ queryKey: getGetQueueQueryKey() });
      },
      onError: (err: Error) => toast({ title: "No patients waiting", variant: "destructive" }),
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
              onSuccess: (consultation) => {
                navigate(`/consultations/${consultation.id}`);
              },
              onError: () => toast({ title: "Error", description: "Failed to create consultation", variant: "destructive" }),
            }
          );
        },
        onError: () => toast({ title: "Error", description: "Failed to update token status", variant: "destructive" }),
      }
    );
  };

  const handleGenerateToken = () => {
    if (!tokenPatientId || !selectedDoctorId) return;
    generateTokenMutation.mutate({ data: { patientId: tokenPatientId, doctorId: selectedDoctorId } }, {
      onSuccess: (token) => {
        toast({ title: `Token #${token.tokenNumber} generated`, description: token.patientName });
        queryClient.invalidateQueries({ queryKey: getGetQueueQueryKey() });
        setShowTokenModal(false);
        setTokenPatientId("");
      },
      onError: () => toast({ title: "Error", description: "Failed to generate token", variant: "destructive" }),
    });
  };

  const tokens = queueData?.tokens ?? [];
  const waiting = tokens.filter(t => t.status === "waiting");
  const inConsultation = tokens.find(t => t.status === "in_consultation" || t.status === "called");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">OPD Queue</h1>
          <p className="text-sm text-muted-foreground">Live queue management</p>
        </div>
        <div className="flex gap-2">
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

      <div className="flex items-center gap-4">
        <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
          <SelectTrigger className="w-64" data-testid="select-doctor">
            <SelectValue placeholder="Select doctor" />
          </SelectTrigger>
          <SelectContent>
            {doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.fullName}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">Auto-refreshes every 30 seconds</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">Waiting</p>
          <p className="text-3xl font-bold text-amber-600">{queueData?.totalWaiting ?? 0}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">Currently Serving</p>
          <p className="text-3xl font-bold text-green-600">{queueData?.currentlyServing ?? "-"}</p>
          {inConsultation && <p className="text-xs text-muted-foreground mt-1">{inConsultation.patientName}</p>}
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">Avg Wait</p>
          <p className="text-3xl font-bold text-blue-600">{queueData?.averageWaitMinutes ?? 0}<span className="text-base font-normal ml-1">min</span></p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : tokens.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
          No tokens generated today
        </div>
      ) : (
        <div className="space-y-3">
          {tokens.filter(t => t.status !== "completed" && t.status !== "cancelled" && t.status !== "skipped").map(token => (
            <div key={token.id} className={`rounded-lg border-2 p-4 flex items-center gap-4 ${statusColors[token.status] ?? ""}`} data-testid={`token-${token.tokenNumber}`}>
              <div className="flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center border-2 border-current font-bold text-2xl">
                {token.tokenNumber}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{token.patientName}</span>
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusBadgeColors[token.status] ?? ""}`}>
                    {token.status.replace("_", " ")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {token.patientPhone ?? "No phone"}
                  {token.estimatedWaitMinutes != null && token.status === "waiting" && (
                    <span className="ml-2">• Est. wait: {token.estimatedWaitMinutes} min</span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                {token.status === "waiting" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(token.id, "called")}>Call</Button>
                    <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(token.id, "skipped")}>Skip</Button>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/billing/new?patientId=${token.patientId}`)}>
                      <Receipt className="h-3.5 w-3.5 mr-1" />New Invoice
                    </Button>
                  </>
                )}
                {(token.status === "called") && (
                  <Button
                    size="sm"
                    onClick={() => handleStartConsultation(token.id, token.patientId, token.doctorId)}
                    disabled={createConsultationMutation.isPending || updateStatusMutation.isPending}
                  >
                    Start Consultation
                  </Button>
                )}
                {token.status === "in_consultation" && (
                  <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(token.id, "completed")}>Complete</Button>
                )}
              </div>
            </div>
          ))}

          {tokens.filter(t => t.status === "completed" || t.status === "skipped").length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Completed</p>
              <div className="space-y-2">
                {tokens.filter(t => t.status === "completed" || t.status === "skipped").map(token => (
                  <div key={token.id} className={`rounded-lg border-2 p-3 flex items-center gap-3 ${statusColors[token.status] ?? ""}`}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center border font-semibold text-sm">
                      {token.tokenNumber}
                    </div>
                    <span className="text-sm text-muted-foreground">{token.patientName}</span>
                    <span className={`ml-auto inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusBadgeColors[token.status] ?? ""}`}>
                      {token.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={showTokenModal} onOpenChange={setShowTokenModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Queue Token</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Patient</label>
              <Select onValueChange={setTokenPatientId}>
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
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowTokenModal(false)}>Cancel</Button>
              <Button onClick={handleGenerateToken} disabled={!tokenPatientId || generateTokenMutation.isPending} data-testid="btn-confirm-generate-token">
                Generate Token
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
