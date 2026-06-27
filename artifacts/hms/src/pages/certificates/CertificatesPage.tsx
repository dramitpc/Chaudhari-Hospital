import { useState, useEffect } from "react";
import { useDebounce } from "../../hooks/useDebounce";
import { Link, useSearch, useLocation } from "wouter";
import {
  useListCertificates, useCreateCertificate, useDeleteCertificate, useUpdateCertificate,
  useListPatients, useListUsers, useGetClinicSettings,
  getListCertificatesQueryKey, getListPatientsQueryKey, getListUsersQueryKey, getGetClinicSettingsQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CalendarIcon, ChevronLeft, ChevronRight, FilePlus, Pencil, Trash2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fmtDate } from "@/lib/dateUtils";

function todayIso() { return new Date().toLocaleDateString("en-CA"); }
function shiftDate(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}
function fmtPickerDate(iso: string) {
  const today = todayIso();
  if (iso === today) return "Today";
  if (iso === shiftDate(today, -1)) return "Yesterday";
  return fmtDate(iso + "T00:00:00");
}

const CERT_TYPES = ["sick_leave", "fitness", "medical", "procedure", "vaccination", "referral_thank_you"];

const certTitles: Record<string, string> = {
  sick_leave: "Sick Leave Certificate",
  fitness: "Fitness Certificate",
  medical: "Medical Certificate",
  procedure: "Procedure Certificate",
  vaccination: "Vaccination Certificate",
  referral_thank_you: "Thanking Letter",
};

const typeColors: Record<string, string> = {
  sick_leave: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  fitness: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  medical: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  procedure: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  vaccination: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  referral_thank_you: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

type PreviewProps = {
  form: {
    type: string;
    issuedDate: string;
    fromDate: string;
    toDate: string;
    diagnosis: string;
    content: string;
  };
  patientName: string;
  doctorName: string;
  clinicName: string;
  clinicAddress?: string;
  clinicPhone?: string;
  clinicReg?: string;
};

function CertPreview({ form, patientName, doctorName, clinicName, clinicAddress, clinicPhone, clinicReg }: PreviewProps) {
  const certTitle = certTitles[form.type] ?? "Medical Certificate";
  const isThankingLetter = form.type === "referral_thank_you";
  const pt = patientName || "Patient Name";
  const dr = doctorName || "Doctor Name";

  return (
    <div className="bg-white text-gray-900 rounded border-2 border-gray-200 p-6 text-[10px] leading-relaxed shadow-sm">
      {/* Clinic header */}
      <div className="text-center border-b-2 border-blue-600 pb-3 mb-4">
        <p className="text-sm font-bold text-blue-700">{clinicName || "ClinicOS"}</p>
        {clinicAddress && <p className="text-muted-foreground mt-0.5">{clinicAddress}</p>}
        {clinicPhone && <p className="text-muted-foreground">Tel: {clinicPhone}</p>}
        {clinicReg && <p className="text-muted-foreground">Reg: {clinicReg}</p>}
      </div>

      {isThankingLetter ? (
        <>
          <div className="text-center mb-4">
            <span className="text-xs font-bold uppercase tracking-widest border-b-2 border-gray-800 pb-0.5">
              Thanking Letter
            </span>
            <p className="text-muted-foreground mt-1">Date: {form.issuedDate || "—"}</p>
          </div>
          <div className="space-y-2">
            <p>To,<br /><strong>Dr. ________</strong></p>
            <p>Dear Dr. ________,</p>
            <p>
              We sincerely thank you for referring <strong>{pt}</strong> to our clinic.
              The patient was examined and treated on <strong>{form.issuedDate || "—"}</strong> by{" "}
              <strong>Dr. {dr}</strong>.
            </p>
            {form.diagnosis && <p><strong>Diagnosis: </strong>{form.diagnosis}</p>}
            {form.fromDate && form.toDate && (
              <p>Treatment period: <strong>{form.fromDate}</strong> to <strong>{form.toDate}</strong></p>
            )}
            {form.content && (
              <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                <p>{form.content}</p>
              </div>
            )}
            <p className="mt-3">We look forward to continued collaboration.</p>
            <p>Thanking you,</p>
          </div>
          <div className="mt-8 pt-2 border-t border-gray-800 w-40">
            <p className="font-medium">Dr. {dr}</p>
            <p className="text-gray-500">Signature &amp; Stamp</p>
          </div>
        </>
      ) : (
        <>
          <div className="text-center mb-4">
            <span className="text-xs font-bold uppercase tracking-widest border-b-2 border-gray-800 pb-0.5">
              {certTitle}
            </span>
            <p className="text-muted-foreground mt-1">Date: {form.issuedDate || "—"}</p>
          </div>
          <div className="space-y-2">
            <p>
              This is to certify that <strong>{pt}</strong> has been examined and{" "}
              {form.type === "sick_leave" ? (
                <>is found to be suffering from <strong>{form.diagnosis || "illness"}</strong> and is advised
                rest from <strong>{form.fromDate || form.issuedDate || "—"}</strong> to{" "}
                <strong>{form.toDate || form.issuedDate || "—"}</strong>.</>
              ) : form.type === "fitness" ? (
                <>is found medically fit for duty/activities as of the date of this certificate.</>
              ) : (
                <>{form.content || "has been issued this certificate as required."}</>
              )}
            </p>
            {form.diagnosis && form.type !== "sick_leave" && (
              <p className="font-medium">Diagnosis: {form.diagnosis}</p>
            )}
            {form.fromDate && form.toDate && form.type !== "sick_leave" && (
              <p>Period: <strong>{form.fromDate}</strong> to <strong>{form.toDate}</strong></p>
            )}
            {form.content && (
              <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                <p>{form.content}</p>
              </div>
            )}
          </div>
          <div className="mt-10 grid grid-cols-2 gap-6">
            <div className="text-center">
              <div className="border-t border-gray-800 pt-1">
                <p className="font-medium">Dr. {dr}</p>
                <p className="text-gray-500">Signature &amp; Stamp</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-gray-800 pt-1">
                <p className="font-medium">{pt}</p>
                <p className="text-gray-500">Patient Signature</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DatePickerField({
  label, value, onChange, placeholder = "Pick a date",
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(value + "T00:00:00") : undefined;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start text-left font-normal h-9 px-3"
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
            {value ? (
              <span>{fmtDate(value + "T00:00:00")}</span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            {value && (
              <X
                className="ml-auto h-3.5 w-3.5 text-muted-foreground hover:text-foreground shrink-0"
                onClick={e => { e.stopPropagation(); onChange(""); setOpen(false); }}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={d => {
              onChange(d ? d.toLocaleDateString("en-CA") : "");
              setOpen(false);
            }}
            captionLayout="dropdown"
            defaultMonth={selected ?? new Date()}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function CertificatesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const urlParams = new URLSearchParams(search);
  const urlPatientId = urlParams.get("patientId") ?? "";
  const urlDoctorId  = urlParams.get("doctorId")  ?? "";

  const [selectedDate, setSelectedDate] = useState(todayIso);
  const isToday = selectedDate === todayIso();

  const [showCreate, setShowCreate] = useState(() => !!(urlPatientId || urlDoctorId));
  const [form, setForm] = useState({
    patientId: urlPatientId,
    doctorId: urlDoctorId || (user?.role === "doctor" ? user?.id ?? "" : ""),
    type: "sick_leave",
    issuedDate: "",
    fromDate: "",
    toDate: "",
    diagnosis: "",
    content: "",
  });

  const [patientSearch, setPatientSearch] = useState("");
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const [selectedPatientObj, setSelectedPatientObj] = useState<{ id: string; fullName: string; patientId: string; phone?: string | null } | null>(null);
  const debouncedApiSearch = useDebounce(patientDropdownOpen ? patientSearch : "", 300);

  const { data, isLoading } = useListCertificates(
    { date: selectedDate, limit: 500 },
    { query: { queryKey: getListCertificatesQueryKey({ date: selectedDate, limit: 500 }) } }
  );
  const { data: patients } = useListPatients(
    { search: debouncedApiSearch || undefined, limit: 50 },
    { query: { queryKey: getListPatientsQueryKey({ search: debouncedApiSearch || undefined, limit: 50 }) } }
  );
  const { data: doctors } = useListUsers({ role: "doctor" }, { query: { queryKey: getListUsersQueryKey({ role: "doctor" }) } });
  const { data: settings } = useGetClinicSettings({ query: { queryKey: getGetClinicSettingsQueryKey() } });
  const createMutation = useCreateCertificate();
  const deleteMutation = useDeleteCertificate();
  const updateMutation = useUpdateCertificate();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingCert, setEditingCert] = useState<{ id: string; type: string; issuedDate: string; fromDate: string; toDate: string; diagnosis: string; content: string } | null>(null);

  const selectedPatient = selectedPatientObj ?? (patients?.data ?? []).find(p => p.id === form.patientId);
  const selectedDoctor = (doctors?.data ?? []).find(d => d.id === form.doctorId);
  const patientName = selectedPatient?.fullName ?? "";
  const doctorName = selectedDoctor?.fullName ?? (user?.role === "doctor" ? (user as unknown as { fullName?: string }).fullName ?? "" : "");

  // Once patients load, populate the search box display text for a URL-pre-filled patient
  useEffect(() => {
    if (urlPatientId && selectedPatient && !patientSearch) {
      setPatientSearch(`${selectedPatient.fullName} · ${selectedPatient.patientId}${selectedPatient.phone ? ` · ${selectedPatient.phone}` : ""}`);
    }
  }, [selectedPatient, urlPatientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetPatientSearch = () => {
    setPatientSearch("");
    setPatientDropdownOpen(false);
    setSelectedPatientObj(null);
  };

  const handleCreate = () => {
    if (!form.patientId || !form.doctorId) return;
    const fromSource = urlParams.get("from") ?? "certificates";
    const fromConsultationId = urlParams.get("consultationId") ?? "";
    createMutation.mutate({ data: form as Parameters<typeof createMutation.mutate>[0]["data"] }, {
      onSuccess: (cert) => {
        queryClient.invalidateQueries({ queryKey: getListCertificatesQueryKey() });
        setShowCreate(false);
        setForm(f => ({ ...f, patientId: "", issuedDate: "", diagnosis: "", content: "", fromDate: "", toDate: "" }));
        resetPatientSearch();
        const printParams = new URLSearchParams({ print: "1", from: fromSource });
        if (fromConsultationId) printParams.set("consultationId", fromConsultationId);
        setLocation(`/certificates/${cert.id}?${printParams.toString()}`);
      },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  };

  const certificates = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Medical Certificates</h1>
          <p className="text-sm text-muted-foreground">{total} certificate{total !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="btn-issue-certificate">
          <FilePlus className="mr-2 h-4 w-4" />
          Issue Certificate
        </Button>
      </div>

      {/* Date picker */}
      <div className="flex flex-wrap items-center gap-2">
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
              max={todayIso()}
              onChange={e => { if (e.target.value) setSelectedDate(e.target.value); }}
              className="h-9 pl-8 pr-2 text-sm bg-transparent focus:outline-none min-w-[130px] cursor-pointer"
            />
          </div>
          <span className={`px-2 text-xs font-medium border-l border-border h-9 flex items-center ${isToday ? "text-primary" : "text-muted-foreground"}`}>
            {fmtPickerDate(selectedDate)}
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
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setSelectedDate(todayIso())}>
            <X className="h-3.5 w-3.5" />Today
          </Button>
        )}
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
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No certificates for {fmtPickerDate(selectedDate)}</td></tr>
            ) : certificates.map(c => (
              <tr key={c.id} className="border-b border-border hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{c.patientName}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.doctorName}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${typeColors[c.type] ?? ""}`}>
                    {c.type.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3">{c.issuedDate ? c.issuedDate.split("-").reverse().join("/") : "—"}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {c.fromDate && c.toDate ? `${c.fromDate.split("-").reverse().join("/")} to ${c.toDate.split("-").reverse().join("/")}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Link href={`/certificates/${c.id}`}>
                      <Button size="sm" variant="outline">View</Button>
                    </Link>
                    <Button size="sm" variant="ghost" onClick={() => setEditingCert({ id: c.id, type: c.type, issuedDate: c.issuedDate ?? "", fromDate: c.fromDate ?? "", toDate: c.toDate ?? "", diagnosis: c.diagnosis ?? "", content: c.content ?? "" })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeletingId(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={showCreate} onOpenChange={v => { setShowCreate(v); if (!v) { resetPatientSearch(); setForm(f => ({ ...f, patientId: "" })); } }}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0" onInteractOutside={e => e.preventDefault()}>
          <div className="grid grid-cols-1 md:grid-cols-[420px_1fr]">
            {/* ── Form panel ── */}
            <div className="p-6 border-r border-border overflow-y-auto max-h-[85vh]">
              <DialogHeader className="mb-4">
                <DialogTitle>Issue Medical Certificate</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Patient</Label>
                  <div className="relative">
                    <Input
                      placeholder="Search by name, ID or mobile…"
                      value={patientSearch}
                      onChange={e => {
                        setPatientSearch(e.target.value);
                        setPatientDropdownOpen(true);
                        if (!e.target.value) setForm(f => ({ ...f, patientId: "" }));
                      }}
                      onFocus={() => setPatientDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setPatientDropdownOpen(false), 150)}
                    />
                    {patientDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 max-h-52 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                        {(patients?.data ?? []).length === 0 ? (
                          <p className="px-3 py-2 text-sm text-muted-foreground">{patientSearch ? "No patients found" : "Type to search…"}</p>
                        ) : (patients?.data ?? []).map(p => (
                          <button
                            key={p.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-baseline gap-2"
                            onMouseDown={() => {
                              setSelectedPatientObj(p);
                              setForm(f => ({ ...f, patientId: p.id }));
                              setPatientSearch(`${p.fullName} · ${p.patientId}${p.phone ? ` · ${p.phone}` : ""}`);
                              setPatientDropdownOpen(false);
                            }}
                          >
                            <span className="font-medium">{p.fullName}</span>
                            <span className="text-xs text-muted-foreground">{p.patientId}</span>
                            {p.phone && <span className="text-xs text-muted-foreground">{p.phone}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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
                      {CERT_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <DatePickerField
                    label="Issued Date"
                    value={form.issuedDate}
                    onChange={v => setForm(f => ({ ...f, issuedDate: v }))}
                    placeholder="Issue date"
                  />
                  <DatePickerField
                    label="From Date"
                    value={form.fromDate}
                    onChange={v => setForm(f => ({ ...f, fromDate: v }))}
                    placeholder="From"
                  />
                  <DatePickerField
                    label="To Date"
                    value={form.toDate}
                    onChange={v => setForm(f => ({ ...f, toDate: v }))}
                    placeholder="To"
                  />
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
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={!form.patientId || !form.doctorId || createMutation.isPending}>
                    {createMutation.isPending ? "Issuing..." : "Issue & Print Certificate"}
                  </Button>
                </div>
              </div>
            </div>

            {/* ── Preview panel ── */}
            <div className="bg-muted/30 p-6 overflow-y-auto max-h-[85vh]">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Live Preview</p>
              <CertPreview
                form={form}
                patientName={patientName}
                doctorName={doctorName}
                clinicName={settings?.clinicName ?? "ClinicOS"}
                clinicAddress={settings?.address ?? undefined}
                clinicPhone={settings?.phone ?? undefined}
                clinicReg={settings?.registrationNumber ?? undefined}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inline edit dialog */}
      {editingCert && (
        <Dialog open={!!editingCert} onOpenChange={v => { if (!v) setEditingCert(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Certificate</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Certificate Type</Label>
                <Select value={editingCert.type} onValueChange={v => setEditingCert(e => e && ({ ...e, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CERT_TYPES.map(t => <SelectItem key={t} value={t}>{certTitles[t] ?? t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <DatePickerField label="Issued Date" value={editingCert.issuedDate} onChange={v => setEditingCert(e => e && ({ ...e, issuedDate: v }))} />
                <DatePickerField label="From Date" value={editingCert.fromDate} onChange={v => setEditingCert(e => e && ({ ...e, fromDate: v }))} />
                <DatePickerField label="To Date" value={editingCert.toDate} onChange={v => setEditingCert(e => e && ({ ...e, toDate: v }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Diagnosis</Label>
                <Input value={editingCert.diagnosis} onChange={e => setEditingCert(f => f && ({ ...f, diagnosis: e.target.value }))} placeholder="Diagnosis / reason" />
              </div>
              <div className="space-y-1.5">
                <Label>Certificate Content</Label>
                <Textarea rows={3} value={editingCert.content} onChange={e => setEditingCert(f => f && ({ ...f, content: e.target.value }))} placeholder="Certificate body text…" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingCert(null)}>Cancel</Button>
              <Button
                disabled={updateMutation.isPending}
                onClick={() => {
                  const { id, ...data } = editingCert;
                  updateMutation.mutate({ id, data: data as import("@workspace/api-client-react").CertificateUpdateInput }, {
                    onSuccess: () => { toast({ title: "Certificate updated" }); queryClient.invalidateQueries({ queryKey: getListCertificatesQueryKey() }); setEditingCert(null); },
                    onError: () => toast({ title: "Update failed", variant: "destructive" }),
                  });
                }}
              >
                {updateMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirmation dialog */}
      {deletingId && (
        <Dialog open={!!deletingId} onOpenChange={v => { if (!v) setDeletingId(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Certificate</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">This will permanently delete this certificate. This action cannot be undone.</p>
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="outline" onClick={() => setDeletingId(null)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ id: deletingId }, {
                  onSuccess: () => { toast({ title: "Certificate deleted" }); queryClient.invalidateQueries({ queryKey: getListCertificatesQueryKey() }); setDeletingId(null); },
                  onError: () => toast({ title: "Delete failed", variant: "destructive" }),
                })}
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
