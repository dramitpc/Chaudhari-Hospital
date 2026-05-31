import { useState } from "react";
import { Link } from "wouter";
import {
  useListCertificates, useCreateCertificate, useListPatients, useListUsers,
  getListCertificatesQueryKey, getListPatientsQueryKey, getListUsersQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { FilePlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const CERT_TYPES = ["sick_leave", "fitness", "medical", "procedure", "vaccination", "referral_thank_you"];

const typeColors: Record<string, string> = {
  sick_leave: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  fitness: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  medical: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  procedure: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  vaccination: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  referral_thank_you: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

export default function CertificatesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    patientId: "",
    doctorId: user?.role === "doctor" ? user?.id ?? "" : "",
    type: "sick_leave",
    issuedDate: new Date().toISOString().split("T")[0],
    fromDate: "",
    toDate: "",
    diagnosis: "",
    content: "",
  });

  const { data, isLoading } = useListCertificates({}, {
    query: { queryKey: getListCertificatesQueryKey({}) }
  });
  const { data: patients } = useListPatients({ limit: 200 }, { query: { queryKey: getListPatientsQueryKey({ limit: 200 }) } });
  const { data: doctors } = useListUsers({ role: "doctor" }, { query: { queryKey: getListUsersQueryKey({ role: "doctor" }) } });
  const createMutation = useCreateCertificate();

  const handleCreate = () => {
    if (!form.patientId || !form.doctorId) return;
    createMutation.mutate({ data: form as Parameters<typeof createMutation.mutate>[0]["data"] }, {
      onSuccess: () => {
        toast({ title: "Certificate issued" });
        queryClient.invalidateQueries({ queryKey: getListCertificatesQueryKey() });
        setShowCreate(false);
        setForm(f => ({ ...f, patientId: "", diagnosis: "", content: "", fromDate: "", toDate: "" }));
      },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  };

  const certificates = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Medical Certificates</h1>
          <p className="text-sm text-muted-foreground">{certificates.length} certificates</p>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="btn-issue-certificate">
          <FilePlus className="mr-2 h-4 w-4" />
          Issue Certificate
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Patient</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Doctor</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Issued Date</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Period</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-border">
                {Array.from({ length: 6 }).map((__, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}
              </tr>
            )) : certificates.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No certificates found</td></tr>
            ) : certificates.map(c => (
              <tr key={c.id} className="border-b border-border hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{c.patientName}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.doctorName}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${typeColors[c.type] ?? ""}`}>
                    {c.type.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3">{c.issuedDate}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {c.fromDate && c.toDate ? `${c.fromDate} to ${c.toDate}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/certificates/${c.id}`}>
                    <Button size="sm" variant="outline">View</Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Issue Medical Certificate</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Patient</Label>
              <Select onValueChange={v => setForm(f => ({ ...f, patientId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>
                  {(patients?.data ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.fullName} ({p.patientId})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {user?.role !== "doctor" && (
              <div className="space-y-1.5">
                <Label>Doctor</Label>
                <Select defaultValue={form.doctorId} onValueChange={v => setForm(f => ({ ...f, doctorId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
                  <SelectContent>
                    {(doctors?.data ?? []).map(d => <SelectItem key={d.id} value={d.id}>{d.fullName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Certificate Type</Label>
              <Select defaultValue={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CERT_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Issued Date</Label>
                <Input type="date" value={form.issuedDate} onChange={e => setForm(f => ({ ...f, issuedDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">From Date</Label>
                <Input type="date" value={form.fromDate} onChange={e => setForm(f => ({ ...f, fromDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">To Date</Label>
                <Input type="date" value={form.toDate} onChange={e => setForm(f => ({ ...f, toDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Diagnosis</Label>
              <Input value={form.diagnosis} onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))} placeholder="Diagnosis / reason" />
            </div>
            <div className="space-y-1.5">
              <Label>Certificate Content</Label>
              <Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                rows={3} placeholder="Certificate body text..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!form.patientId || !form.doctorId || createMutation.isPending}>
                Issue Certificate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
