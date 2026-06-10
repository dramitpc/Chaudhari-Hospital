import { useState, useMemo, useEffect } from "react";
import { Link, useSearch } from "wouter";
import {
  useListCertificates, useCreateCertificate, useListPatients, useListUsers, useGetClinicSettings,
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
import { CalendarDays, CalendarIcon, ChevronLeft, ChevronRight, Eye, FilePlus, X } from "lucide-react";
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
  sick_leave: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  fitness: "bg-green-50 text-green-700 ring-1 ring-green-200",
  medical: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  procedure: "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
  vaccination: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",
  referral_thank_you: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};

const typeLabels: Record<string, string> = {
  sick_leave: "Sick Leave",
  fitness: "Fitness",
  medical: "Medical",
  procedure: "Procedure",
  vaccination: "Vaccination",
  referral_thank_you: "Thanking Letter",
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

  const { data, isLoading } = useListCertificates(
    { date: selectedDate, limit: 500 },
    { query: { queryKey: getListCertificatesQueryKey({ date: selectedDate, limit: 500 }) } }
  );
  const { data: patients } = useListPatients({ limit: 500 }, { query: { queryKey: getListPatientsQueryKey({ limit: 500 }) } });
  const { data: doctors } = useListUsers({ role: "doctor" }, { query: { queryKey: getListUsersQueryKey({ role: "doctor" }) } });
  const { data: settings } = useGetClinicSettings({ query: { queryKey: getGetClinicSettingsQueryKey() } });
  const createMutation = useCreateCertificate();

  const filteredPatients = useMemo(() => {
    const q = patientSearch.toLowerCase();
    return (patients?.data ?? []).filter(p =>
      p.fullName.toLowerCase().includes(q) ||
      p.patientId.toLowerCase().includes(q) ||
      (p.phone ?? "").includes(q)
    );
  }, [patients?.data, patientSearch]);

  const selectedPatient = (patients?.data ?? []).find(p => p.id === form.patientId);
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
  };

  const handleCreate = () => {
    if (!form.patientId || !form.doctorId) return;
    createMutation.mutate({ data: form as Parameters<typeof createMutation.mutate>[0]["data"] }, {
      onSuccess: () => {
        toast({ title: "Certificate issued" });
        queryClient.invalidateQueries({ queryKey: getListCertificatesQueryKey() });
        setShowCreate(false);
        setForm(f => ({ ...f, patientId: "", issuedDate: "", diagnosis: "", content: "", fromDate: "", toDate: "" }));
        resetPatientSearch();
      },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  };

  const certificates = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-5">
      {/* Header — two-level hierarchy */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-widest mb-1">Administration · Certificates</p>
          <h1 className="text-2xl font-bold">Medical Certificates</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} certificate{total !== 1 ? "s" : ""} issued on{" "}
            <span className="font-medium text-foreground">{fmtPickerDate(selectedDate)}</span>
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          data-testid="btn-issue-certificate"
          className="shadow-sm"
        >
          <FilePlus className="mr-2 h-4 w-4" />
          Issue Certificate
        </Button>
      </div>

      {/* Date navigation — blue pill design */}
      <div className="flex items-center gap-2">
        <button
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setSelectedDate(d => shiftDate(d, -1))}
          aria-label="Previous day"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 border transition-colors ${
            isToday
              ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300"
              : "bg-background border-border text-foreground hover:border-primary/50"
          }`}
          onClick={() => !isToday && setSelectedDate(todayIso())}
          aria-label={isToday ? "Viewing today" : "Click to return to today"}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span className="text-sm font-semibold">{fmtPickerDate(selectedDate)}</span>
          {isToday && (
            <span className="text-xs font-medium bg-blue-100 text-blue-500 dark:bg-blue-900/60 dark:text-blue-400 rounded px-1.5 py-0.5">
              Today
            </span>
          )}
        </button>
        <button
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={() => setSelectedDate(d => shiftDate(d, 1))}
          disabled={isToday}
          aria-label="Next day"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-6 py-3.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider w-[28%]">Patient</th>
              <th className="px-4 py-3.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider w-[24%]">Issuing Doctor</th>
              <th className="px-4 py-3.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider w-[13%]">Type</th>
              <th className="px-4 py-3.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider w-[13%]">Issued</th>
              <th className="px-4 py-3.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Period</th>
              <th className="px-4 py-3.5 w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                {Array.from({ length: 6 }).map((__, j) => <td key={j} className="px-4 py-4"><Skeleton className="h-4 w-full" /></td>)}
              </tr>
            )) : certificates.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">No certificates for {fmtPickerDate(selectedDate)}</td></tr>
            ) : certificates.map((c, i) => (
              <tr key={c.id} className={`hover:bg-muted/20 transition-colors ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
                <td className="px-6 py-4">
                  <span className="font-semibold text-foreground">{c.patientName}</span>
                </td>
                <td className="px-4 py-4 text-muted-foreground">{c.doctorName}</td>
                <td className="px-4 py-4">
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${typeColors[c.type] ?? "bg-muted text-muted-foreground ring-1 ring-border"}`}>
                    {typeLabels[c.type] ?? c.type.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-4 text-sm font-mono text-foreground/80">
                  {c.issuedDate ? c.issuedDate.split("-").reverse().join("/") : "—"}
                </td>
                <td className="px-4 py-4">
                  {c.fromDate && c.toDate ? (
                    <span className="text-xs text-muted-foreground font-medium bg-muted rounded px-2 py-1">
                      {c.fromDate.split("-").reverse().join("/")} – {c.toDate.split("-").reverse().join("/")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/30 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-4 text-right">
                  <Link href={`/certificates/${c.id}`}>
                    <button className="text-primary hover:text-primary/80 font-medium text-xs flex items-center gap-1 ml-auto transition-colors">
                      <Eye className="h-3.5 w-3.5" /> View
                    </button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isLoading && certificates.length > 0 && (
        <p className="text-xs text-muted-foreground/60 text-right">
          Showing {certificates.length} of {total} certificate{total !== 1 ? "s" : ""}
        </p>
      )}

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
                        {filteredPatients.length === 0 ? (
                          <p className="px-3 py-2 text-sm text-muted-foreground">No patients found</p>
                        ) : filteredPatients.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-baseline gap-2"
                            onMouseDown={() => {
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
                    {createMutation.isPending ? "Issuing..." : "Issue Certificate"}
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
    </div>
  );
}
