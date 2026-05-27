import { useRoute, useLocation, Link } from "wouter";
import { useState, useEffect } from "react";
import {
  useGetConsultation, useUpdateConsultation, useCompleteConsultation,
  useListPrescriptions, useCreatePrescription, useListDrugs,
  useGetPatient, useUpdatePatient, useGetClinicSettings,
  getGetConsultationQueryKey, getListPrescriptionsQueryKey, getListDrugsQueryKey, getGetPatientQueryKey, getGetClinicSettingsQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle, Plus, Printer, FileText, Mail, Send, Star, Clock, X, BookMarked } from "lucide-react";

type DrugItem = {
  drugId?: string | null;
  drugName: string;
  genericName?: string | null;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string | null;
  quantity?: number | null;
};

export default function ConsultationDetailPage() {
  const [, params] = useRoute("/consultations/:id");
  const id = params?.id ?? "";
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: consultation, isLoading } = useGetConsultation(id, {
    query: { enabled: !!id, queryKey: getGetConsultationQueryKey(id) }
  });

  const { data: prescriptionsData } = useListPrescriptions(
    { consultationId: id },
    { query: { enabled: !!id, queryKey: getListPrescriptionsQueryKey({ consultationId: id }) } }
  );

  const { data: drugsData } = useListDrugs({}, { query: { queryKey: getListDrugsQueryKey({}) } });

  const updateMutation = useUpdateConsultation();
  const completeMutation = useCompleteConsultation();
  const createPrescriptionMutation = useCreatePrescription();
  const updatePatientMutation = useUpdatePatient();

  const patientId = consultation?.patientId ?? "";
  const { data: patient } = useGetPatient(patientId, {
    query: { enabled: !!patientId, queryKey: getGetPatientQueryKey(patientId) }
  });
  const { data: clinicSettings } = useGetClinicSettings({ query: { queryKey: getGetClinicSettingsQueryKey() } });

  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [drugItems, setDrugItems] = useState<DrugItem[]>([
    { drugName: "", dosage: "", frequency: "", duration: "", instructions: "" }
  ]);

  // ── SOAP templates ────────────────────────────────────────────────────────
  type SoapTemplate = { id: string; name: string; fields: Record<string, string>; savedAt: number };
  const SOAP_FIELDS = ["soapSubjective", "soapObjective", "soapAssessment", "soapPlan"] as const;
  type SoapField = typeof SOAP_FIELDS[number];

  const [soapValues, setSoapValues] = useState<Record<SoapField, string>>({
    soapSubjective: "", soapObjective: "", soapAssessment: "", soapPlan: ""
  });
  const [soapInitialized, setSoapInitialized] = useState(false);
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [showSaveFav, setShowSaveFav] = useState(false);
  const [favName, setFavName] = useState("");
  const [, forceTemplateRefresh] = useState(0);

  useEffect(() => {
    if (consultation && !soapInitialized) {
      setSoapValues({
        soapSubjective: consultation.soapSubjective ?? "",
        soapObjective:  consultation.soapObjective  ?? "",
        soapAssessment: consultation.soapAssessment ?? "",
        soapPlan:       consultation.soapPlan       ?? "",
      });
      setSoapInitialized(true);
    }
  }, [consultation, soapInitialized]);

  const LS_FAV = "clinicos_soap_favourites";
  const LS_RECENT = "clinicos_soap_recent";
  const getFavourites  = (): SoapTemplate[] => JSON.parse(localStorage.getItem(LS_FAV)    ?? "[]");
  const getRecent      = (): SoapTemplate[] => JSON.parse(localStorage.getItem(LS_RECENT) ?? "[]");
  const persistFav     = (list: SoapTemplate[]) => { localStorage.setItem(LS_FAV, JSON.stringify(list)); forceTemplateRefresh(n => n + 1); };
  const persistRecent  = (list: SoapTemplate[]) => { localStorage.setItem(LS_RECENT, JSON.stringify(list)); forceTemplateRefresh(n => n + 1); };

  const handleSoapChange = (field: SoapField, value: string) =>
    setSoapValues(prev => ({ ...prev, [field]: value }));

  const handleSoapBlur = (field: SoapField, value: string) => {
    handleBlur(field, value);
    const current = { ...soapValues, [field]: value };
    if (!Object.values(current).some(v => v.trim())) return;
    const deduped = getRecent().filter(r =>
      !(r.fields.soapSubjective === current.soapSubjective &&
        r.fields.soapObjective  === current.soapObjective  &&
        r.fields.soapAssessment === current.soapAssessment &&
        r.fields.soapPlan       === current.soapPlan)
    ).slice(0, 4);
    persistRecent([{ id: Date.now().toString(), name: "", fields: current, savedAt: Date.now() }, ...deduped]);
  };

  const applyTemplate = (fields: Record<string, string>) => {
    const next: Record<SoapField, string> = {
      soapSubjective: fields.soapSubjective ?? "",
      soapObjective:  fields.soapObjective  ?? "",
      soapAssessment: fields.soapAssessment ?? "",
      soapPlan:       fields.soapPlan       ?? "",
    };
    setSoapValues(next);
    SOAP_FIELDS.forEach(f => handleBlur(f, next[f]));
    setShowTemplatePanel(false);
    toast({ title: "Template applied" });
  };

  const saveAsFavourite = () => {
    if (!favName.trim()) return;
    persistFav([...getFavourites(), { id: Date.now().toString(), name: favName.trim(), fields: soapValues, savedAt: Date.now() }]);
    setFavName(""); setShowSaveFav(false);
    toast({ title: "Saved to favourites" });
  };

  const deleteFav = (fid: string) => persistFav(getFavourites().filter(f => f.id !== fid));
  const deleteRecent = (rid: string) => persistRecent(getRecent().filter(r => r.id !== rid));
  const templateLabel = (t: SoapTemplate) =>
    t.name || (t.fields.soapSubjective?.slice(0, 45) + (t.fields.soapSubjective?.length > 45 ? "…" : "")) || "Untitled";
  // ────────────────────────────────────────────────────────────────────────────

  const [showThankingLetter, setShowThankingLetter] = useState(false);
  const [thankingDoctorName, setThankingDoctorName] = useState("");
  const [thankingDoctorAddress, setThankingDoctorAddress] = useState("");

  const [showReferralLetter, setShowReferralLetter] = useState(false);
  const [referralToDoctor, setReferralToDoctor] = useState("");
  const [referralToSpecialty, setReferralToSpecialty] = useState("");
  const [referralToAddress, setReferralToAddress] = useState("");
  const [referralReason, setReferralReason] = useState("");

  const handlePrintLetter = (elementId: string, title: string) => {
    const content = document.getElementById(elementId)?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
      body{font-family:"Times New Roman",serif;max-width:680px;margin:48px auto;padding:0 24px;line-height:1.7;color:#111}
      h2{font-size:1.1rem;font-weight:bold;margin:0 0 2px}
      h3{font-size:0.95rem;font-weight:bold;margin:20px 0 4px}
      p{margin:6px 0}
      .clinic-header{border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:24px}
      .clinic-name{font-size:1.3rem;font-weight:bold;letter-spacing:0.02em}
      .letter-body{margin-top:20px}
      .signature-block{margin-top:48px}
      @media print{body{margin:24px}}
    </style></head><body>${content}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  const handleBlur = (field: string, value: string) => {
    if (!id) return;
    updateMutation.mutate({ id, data: { [field]: value } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetConsultationQueryKey(id) }),
    });
  };

  const handleMedHistBlur = (field: string, value: string) => {
    if (!patientId) return;
    updatePatientMutation.mutate({ id: patientId, data: { [field]: value } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPatientQueryKey(patientId) }),
    });
  };

  const handleComplete = () => {
    completeMutation.mutate({ id, data: {} }, {
      onSuccess: () => {
        toast({ title: "Consultation completed" });
        queryClient.invalidateQueries({ queryKey: getGetConsultationQueryKey(id) });
      },
      onError: () => toast({ title: "Error completing consultation", variant: "destructive" }),
    });
  };

  const buildPrescriptionPayload = () => ({
    patientId: consultation!.patientId,
    doctorId: consultation!.doctorId,
    consultationId: id,
    diagnosis: consultation!.diagnosis ?? undefined,
    advice: consultation!.advice ?? undefined,
    followUpDate: consultation!.followUpDate ?? undefined,
    items: drugItems.filter(i => i.drugName),
  });

  const handleAddPrescription = (andPrint = false) => {
    if (!consultation) return;
    createPrescriptionMutation.mutate({ data: buildPrescriptionPayload() }, {
      onSuccess: (rx) => {
        toast({ title: "Prescription created" });
        queryClient.invalidateQueries({ queryKey: getListPrescriptionsQueryKey({ consultationId: id }) });
        setShowPrescriptionModal(false);
        setDrugItems([{ drugName: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
        if (andPrint) navigate(`/prescriptions/${rx.id}?print=1`);
      },
    });
  };

  const addDrugRow = () => setDrugItems(prev => [...prev, { drugName: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
  const removeDrugRow = (i: number) => setDrugItems(prev => prev.filter((_, idx) => idx !== i));
  const updateDrugRow = (i: number, field: keyof DrugItem, value: string | number | null) => {
    setDrugItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };

  const drugs = drugsData?.data ?? [];
  const prescriptions = prescriptionsData?.data ?? [];

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!consultation) return <div className="text-center py-8 text-muted-foreground">Consultation not found</div>;

  const medHistoryParts: string[] = [];
  if (patient) {
    const p = patient as unknown as Record<string, string | null>;
    if (p.allergies)       medHistoryParts.push(`🚨 Allergies: ${p.allergies}`);
    if (p.medicalHistory)  medHistoryParts.push(`🏥 Past Medical: ${p.medicalHistory}`);
    if (p.surgicalHistory) medHistoryParts.push(`🔪 Surgical: ${p.surgicalHistory}`);
    if (p.familyHistory)   medHistoryParts.push(`👨‍👩‍👧 Family: ${p.familyHistory}`);
  }
  const marqueeText = medHistoryParts.join("   •   ");

  return (
    <div className="space-y-4">
      <style>{`
        @keyframes marquee-scroll {
          0%   { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee { animation: marquee-scroll 30s linear infinite; }
        .animate-marquee:hover { animation-play-state: paused; }
      `}</style>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/consultations")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{consultation.patientName}</h1>
            <p className="text-sm text-muted-foreground">{consultation.doctorName} · {consultation.visitDate}</p>
          </div>
          <Badge variant={consultation.status === "completed" ? "secondary" : "default"}>
            {consultation.status.replace("_", " ")}
          </Badge>
        </div>
        {consultation.status !== "completed" && (
          <Button onClick={handleComplete} disabled={completeMutation.isPending} data-testid="btn-complete-consultation">
            <CheckCircle className="mr-2 h-4 w-4" />
            Complete
          </Button>
        )}
      </div>

      {marqueeText && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 px-3 py-1.5 overflow-hidden">
          <span className="shrink-0 text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
            Med History
          </span>
          <div className="relative flex-1 overflow-hidden">
            <p className="animate-marquee whitespace-nowrap text-xs text-amber-800 dark:text-amber-300 cursor-default">
              {marqueeText}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h3 className="font-semibold text-sm">Diagnosis &amp; Advice</h3>
            <div className="space-y-1.5">
              <Label className="text-xs">Diagnosis</Label>
              <Input
                defaultValue={consultation.diagnosis ?? ""}
                onBlur={e => handleBlur("diagnosis", e.target.value)}
                placeholder="Primary diagnosis"
                data-testid="input-diagnosis"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ICD-10 Code</Label>
              <Input
                defaultValue={consultation.icd10Code ?? ""}
                onBlur={e => handleBlur("icd10Code", e.target.value)}
                placeholder="J06.9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Follow-up Date</Label>
              <Input
                type="date"
                defaultValue={consultation.followUpDate ?? ""}
                onBlur={e => handleBlur("followUpDate", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Advice</Label>
              <Textarea
                defaultValue={consultation.advice ?? ""}
                onBlur={e => handleBlur("advice", e.target.value)}
                rows={3}
                placeholder="Advice and instructions..."
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Prescriptions</h3>
              <Button size="sm" variant="outline" onClick={() => setShowPrescriptionModal(true)}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            {prescriptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No prescriptions yet</p>
            ) : prescriptions.map(p => (
              <Link key={p.id} href={`/prescriptions/${p.id}`}>
                <div className="rounded border border-border p-2 hover:bg-muted/30 cursor-pointer">
                  <p className="text-xs font-medium">{p.items.length} medications</p>
                  <p className="text-xs text-muted-foreground">{p.visitDate}</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <h3 className="font-semibold text-sm">Quick Actions</h3>
            <Link href={`/certificates`}>
              <Button size="sm" variant="outline" className="w-full justify-start">
                <FileText className="mr-2 h-3 w-3" /> Generate Certificate
              </Button>
            </Link>
            <Button size="sm" variant="outline" className="w-full justify-start" onClick={() => setShowThankingLetter(true)}>
              <Mail className="mr-2 h-3 w-3" /> Thanking Letter
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start" onClick={() => setShowReferralLetter(true)}>
              <Send className="mr-2 h-3 w-3" /> Referral Letter
            </Button>
          </div>
        </div>

        <div className="lg:col-span-2">
          <Tabs defaultValue="soap">
            <TabsList className="w-full">
              <TabsTrigger value="soap" className="flex-1">SOAP Notes</TabsTrigger>
              <TabsTrigger value="medhistory" className="flex-1">Medical History</TabsTrigger>
              <TabsTrigger value="clinical" className="flex-1">Clinical Notes</TabsTrigger>
              <TabsTrigger value="investigation" className="flex-1">Investigations</TabsTrigger>
            </TabsList>

            <TabsContent value="soap" className="mt-4 space-y-3">
              {/* Template toolbar */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm" variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => setShowTemplatePanel(v => !v)}
                >
                  <BookMarked className="h-3 w-3" />
                  Favourites &amp; Recent
                </Button>
                <Button
                  size="sm" variant="ghost"
                  className="h-7 gap-1.5 text-xs text-muted-foreground"
                  onClick={() => setShowSaveFav(true)}
                >
                  <Star className="h-3 w-3" />
                  Save as Favourite
                </Button>
              </div>

              {/* Template panel */}
              {showTemplatePanel && (() => {
                const favs   = getFavourites();
                const recent = getRecent();
                return (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3 text-xs">
                    {favs.length === 0 && recent.length === 0 && (
                      <p className="text-muted-foreground text-center py-2">No favourites or recent entries yet. Fill in SOAP notes and save.</p>
                    )}

                    {favs.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                          <Star className="h-3 w-3" /> Favourites
                        </div>
                        {favs.map(t => (
                          <div key={t.id} className="flex items-center justify-between gap-2 rounded border border-border bg-card px-2 py-1.5">
                            <span className="truncate flex-1 font-medium">{templateLabel(t)}</span>
                            <div className="flex gap-1 shrink-0">
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => applyTemplate(t.fields)}>Apply</Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => deleteFav(t.id)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {recent.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                          <Clock className="h-3 w-3" /> Recently Used
                        </div>
                        {recent.map(t => (
                          <div key={t.id} className="flex items-center justify-between gap-2 rounded border border-border bg-card px-2 py-1.5">
                            <div className="flex-1 min-w-0">
                              <span className="truncate block">{templateLabel(t)}</span>
                              <span className="text-muted-foreground">{new Date(t.savedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => applyTemplate(t.fields)}>Apply</Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => deleteRecent(t.id)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* SOAP fields — controlled */}
              {(SOAP_FIELDS).map(field => {
                const labels: Record<string, string> = {
                  soapSubjective: "S — Subjective (What the patient reports)",
                  soapObjective:  "O — Objective (Examination findings)",
                  soapAssessment: "A — Assessment (Diagnosis, differential)",
                  soapPlan:       "P — Plan (Treatment, investigations, follow-up)",
                };
                return (
                  <div key={field} className="space-y-1.5">
                    <Label className="text-xs font-medium">{labels[field]}</Label>
                    <Textarea
                      value={soapValues[field]}
                      onChange={e => handleSoapChange(field, e.target.value)}
                      onBlur={e => handleSoapBlur(field, e.target.value)}
                      rows={4}
                      placeholder={`Enter ${field.replace("soap", "")} notes...`}
                      data-testid={`textarea-${field}`}
                    />
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="medhistory" className="mt-4 space-y-3">
              {patient ? (
                <>
                  {([
                    { field: "allergies",         label: "Known Allergies",       placeholder: "Drug allergies, food allergies, environmental triggers..." },
                    { field: "medicalHistory",    label: "Past Medical History",  placeholder: "Chronic conditions, past illnesses, hospitalisations..." },
                    { field: "surgicalHistory",   label: "Surgical History",      placeholder: "Previous surgeries, procedures, dates..." },
                    { field: "familyHistory",     label: "Family History",        placeholder: "Hereditary conditions, family illnesses..." },
                    { field: "currentMedications",label: "Current Medications",   placeholder: "Ongoing medications, dosages, duration..." },
                  ] as const).map(({ field, label, placeholder }) => (
                    <div key={field} className="space-y-1.5">
                      <Label className="text-xs font-medium">{label}</Label>
                      <Textarea
                        key={`${patientId}-${field}`}
                        defaultValue={(patient as unknown as Record<string, string | null>)[field] ?? ""}
                        onBlur={e => handleMedHistBlur(field, e.target.value)}
                        rows={3}
                        placeholder={placeholder}
                      />
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">Changes auto-save on blur and update the patient record.</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">Loading patient record…</p>
              )}
            </TabsContent>

            <TabsContent value="clinical" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Chief Complaint</Label>
                <Input
                  defaultValue={consultation.chiefComplaint ?? ""}
                  onBlur={e => handleBlur("chiefComplaint", e.target.value)}
                  placeholder="Main presenting complaint"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">History of Present Illness</Label>
                <Textarea
                  defaultValue={consultation.historyOfPresentIllness ?? ""}
                  onBlur={e => handleBlur("historyOfPresentIllness", e.target.value)}
                  rows={4}
                  placeholder="Detailed illness history..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Clinical Notes</Label>
                <Textarea
                  defaultValue={consultation.clinicalNotes ?? ""}
                  onBlur={e => handleBlur("clinicalNotes", e.target.value)}
                  rows={6}
                  placeholder="Additional clinical observations..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Follow-up Notes</Label>
                <Textarea
                  defaultValue={consultation.followUpNotes ?? ""}
                  onBlur={e => handleBlur("followUpNotes", e.target.value)}
                  rows={3}
                  placeholder="Follow-up instructions..."
                />
              </div>
            </TabsContent>

            <TabsContent value="investigation" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Investigation Orders</Label>
                <Textarea
                  defaultValue={consultation.investigationOrders ?? ""}
                  onBlur={e => handleBlur("investigationOrders", e.target.value)}
                  rows={10}
                  placeholder="Blood tests, imaging, referrals..."
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={showPrescriptionModal} onOpenChange={setShowPrescriptionModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Add Prescription</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left py-1 pr-2 w-44">Drug Name</th>
                    <th className="text-left py-1 pr-2 w-24">Dosage</th>
                    <th className="text-left py-1 pr-2 w-28">Frequency</th>
                    <th className="text-left py-1 pr-2 w-20">Duration</th>
                    <th className="text-left py-1 pr-2">Instructions</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {drugItems.map((item, i) => (
                    <tr key={i}>
                      <td className="pr-2 py-1">
                        <Select onValueChange={v => {
                          const drug = drugs.find(d => d.id === v);
                          if (drug) {
                            updateDrugRow(i, "drugId", drug.id);
                            updateDrugRow(i, "drugName", drug.name);
                            updateDrugRow(i, "dosage", drug.defaultDosage ?? "");
                            updateDrugRow(i, "frequency", drug.defaultFrequency ?? "");
                            updateDrugRow(i, "duration", drug.defaultDuration ?? "");
                            updateDrugRow(i, "instructions", drug.defaultInstructions ?? "");
                          }
                        }}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select drug" />
                          </SelectTrigger>
                          <SelectContent>
                            {drugs.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input
                          className="h-7 text-xs mt-1"
                          value={item.drugName}
                          onChange={e => updateDrugRow(i, "drugName", e.target.value)}
                          placeholder="Or type manually"
                        />
                      </td>
                      <td className="pr-2 py-1">
                        <Input className="h-8 text-xs" value={item.dosage} onChange={e => updateDrugRow(i, "dosage", e.target.value)} placeholder="500mg" />
                      </td>
                      <td className="pr-2 py-1">
                        <Input className="h-8 text-xs" value={item.frequency} onChange={e => updateDrugRow(i, "frequency", e.target.value)} placeholder="TDS" />
                      </td>
                      <td className="pr-2 py-1">
                        <Input className="h-8 text-xs" value={item.duration} onChange={e => updateDrugRow(i, "duration", e.target.value)} placeholder="5 days" />
                      </td>
                      <td className="pr-2 py-1">
                        <Input className="h-8 text-xs" value={item.instructions ?? ""} onChange={e => updateDrugRow(i, "instructions", e.target.value)} placeholder="After food" />
                      </td>
                      <td className="py-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeDrugRow(i)}>×</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="outline" size="sm" onClick={addDrugRow}>
              <Plus className="h-3 w-3 mr-1" /> Add Drug
            </Button>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPrescriptionModal(false)}>Cancel</Button>
              <Button
                variant="outline"
                onClick={() => handleAddPrescription(true)}
                disabled={createPrescriptionMutation.isPending}
              >
                <Printer className="mr-2 h-4 w-4" />
                Save &amp; Print
              </Button>
              <Button onClick={() => handleAddPrescription(false)} disabled={createPrescriptionMutation.isPending}>
                Save Prescription
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save as Favourite Dialog */}
      <Dialog open={showSaveFav} onOpenChange={setShowSaveFav}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save SOAP Notes as Favourite</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Template Name</Label>
              <Input
                value={favName}
                onChange={e => setFavName(e.target.value)}
                placeholder="e.g. URTI, Post-op follow-up, Hypertension review…"
                onKeyDown={e => e.key === "Enter" && saveAsFavourite()}
                autoFocus
              />
            </div>
            <div className="rounded border border-border bg-muted/30 p-2 text-xs text-muted-foreground space-y-0.5">
              {SOAP_FIELDS.map(f => soapValues[f] ? (
                <p key={f} className="truncate"><span className="font-medium capitalize">{f.replace("soap", "")}:</span> {soapValues[f]}</p>
              ) : null)}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowSaveFav(false)}>Cancel</Button>
              <Button size="sm" onClick={saveAsFavourite} disabled={!favName.trim()}>
                <Star className="mr-1.5 h-3 w-3" /> Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Thanking Letter Modal */}
      <Dialog open={showThankingLetter} onOpenChange={setShowThankingLetter}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Thanking Letter to Referring Doctor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Referring Doctor's Name</Label>
                <Input
                  value={thankingDoctorName}
                  onChange={e => setThankingDoctorName(e.target.value)}
                  placeholder="Dr. ..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Referring Doctor's Address / Hospital</Label>
                <Input
                  value={thankingDoctorAddress}
                  onChange={e => setThankingDoctorAddress(e.target.value)}
                  placeholder="Clinic / Hospital name"
                />
              </div>
            </div>

            <div className="rounded border border-border bg-muted/20 p-4 text-sm font-serif leading-relaxed" id="thanking-letter-content">
              <div className="clinic-header">
                <div className="clinic-name">{(clinicSettings as unknown as Record<string, string> | undefined)?.clinicName ?? "ClinicOS Healthcare"}</div>
                <div>{(clinicSettings as unknown as Record<string, string> | undefined)?.address ?? ""}</div>
                <div>{(clinicSettings as unknown as Record<string, string> | undefined)?.phone ?? ""}</div>
              </div>
              <p><strong>Date:</strong> {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</p>
              <br />
              <p><strong>To,</strong></p>
              <p>{thankingDoctorName || "Dr. _______________"}</p>
              <p>{thankingDoctorAddress || "_______________"}</p>
              <br />
              <p><strong>Sub: Acknowledgement &amp; Thank You — Patient Referral</strong></p>
              <br />
              <p>Dear {thankingDoctorName || "Doctor"},</p>
              <br />
              <p>
                I am writing to sincerely thank you for referring your patient,{" "}
                <strong>{consultation?.patientName ?? "—"}</strong>
                {(patient as unknown as Record<string, string> | undefined)?.age ? ` (Age: ${(patient as unknown as Record<string, string>).age})` : ""},
                to our clinic. The patient was seen on <strong>{consultation?.visitDate ?? "—"}</strong>.
              </p>
              <br />
              {consultation?.diagnosis && (
                <p>
                  Upon examination, the working diagnosis was noted as:{" "}
                  <strong>{consultation.diagnosis}</strong>.
                  {consultation.soapPlan ? ` The management plan includes: ${consultation.soapPlan}.` : ""}
                </p>
              )}
              <br />
              <p>
                We appreciate your confidence in our care and are committed to keeping you informed about this patient's progress. Please do not hesitate to contact us should you require any further information or wish to discuss the case.
              </p>
              <br />
              <p>Thanking you once again for your valued referral.</p>
              <br />
              <div className="signature-block">
                <p>Yours sincerely,</p>
                <br /><br />
                <p><strong>{consultation?.doctorName ?? "_______________"}</strong></p>
                <p>{(clinicSettings as unknown as Record<string, string> | undefined)?.clinicName ?? ""}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowThankingLetter(false)}>Close</Button>
              <Button onClick={() => handlePrintLetter("thanking-letter-content", "Thanking Letter")}>
                <Printer className="mr-2 h-4 w-4" /> Print Letter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Referral Letter Modal */}
      <Dialog open={showReferralLetter} onOpenChange={setShowReferralLetter}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Referral Letter</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Refer To (Doctor Name)</Label>
                <Input
                  value={referralToDoctor}
                  onChange={e => setReferralToDoctor(e.target.value)}
                  placeholder="Dr. ..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Specialty</Label>
                <Input
                  value={referralToSpecialty}
                  onChange={e => setReferralToSpecialty(e.target.value)}
                  placeholder="e.g. Cardiology, Orthopaedics..."
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hospital / Clinic Address</Label>
              <Input
                value={referralToAddress}
                onChange={e => setReferralToAddress(e.target.value)}
                placeholder="Referred hospital or clinic"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reason for Referral (additional notes)</Label>
              <Textarea
                value={referralReason}
                onChange={e => setReferralReason(e.target.value)}
                rows={2}
                placeholder="Specific concerns, investigations requested, urgency..."
              />
            </div>

            <div className="rounded border border-border bg-muted/20 p-4 text-sm font-serif leading-relaxed" id="referral-letter-content">
              <div className="clinic-header">
                <div className="clinic-name">{(clinicSettings as unknown as Record<string, string> | undefined)?.clinicName ?? "ClinicOS Healthcare"}</div>
                <div>{(clinicSettings as unknown as Record<string, string> | undefined)?.address ?? ""}</div>
                <div>{(clinicSettings as unknown as Record<string, string> | undefined)?.phone ?? ""}</div>
              </div>
              <p><strong>Date:</strong> {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</p>
              <br />
              <p><strong>To,</strong></p>
              <p>{referralToDoctor || "Dr. _______________"}</p>
              <p>{referralToSpecialty ? `Consultant — ${referralToSpecialty}` : "_______________"}</p>
              <p>{referralToAddress || ""}</p>
              <br />
              <p><strong>Sub: Referral Letter — {consultation?.patientName ?? "Patient"}</strong></p>
              <br />
              <p>Dear {referralToDoctor ? `Dr. ${referralToDoctor.replace(/^Dr\.?\s*/i, "")}` : "Doctor"},</p>
              <br />
              <p>
                I am referring my patient, <strong>{consultation?.patientName ?? "—"}</strong>
                {(patient as unknown as Record<string, string> | undefined)?.age ? `, aged ${(patient as unknown as Record<string, string>).age}` : ""}
                {(patient as unknown as Record<string, string> | undefined)?.gender ? `, ${(patient as unknown as Record<string, string>).gender}` : ""},
                for your expert opinion and management
                {referralToSpecialty ? ` in ${referralToSpecialty}` : ""}.
              </p>
              <br />
              {consultation?.diagnosis && (
                <p><strong>Diagnosis:</strong> {consultation.diagnosis}{consultation.icd10Code ? ` (ICD-10: ${consultation.icd10Code})` : ""}</p>
              )}
              {consultation?.chiefComplaint && (
                <p><strong>Chief Complaint:</strong> {consultation.chiefComplaint}</p>
              )}
              {consultation?.soapAssessment && (
                <p><strong>Assessment:</strong> {consultation.soapAssessment}</p>
              )}
              {(patient as unknown as Record<string, string> | undefined)?.medicalHistory && (
                <p><strong>Past Medical History:</strong> {(patient as unknown as Record<string, string>).medicalHistory}</p>
              )}
              {(patient as unknown as Record<string, string> | undefined)?.currentMedications && (
                <p><strong>Current Medications:</strong> {(patient as unknown as Record<string, string>).currentMedications}</p>
              )}
              {(patient as unknown as Record<string, string> | undefined)?.allergies && (
                <p><strong>Allergies:</strong> {(patient as unknown as Record<string, string>).allergies}</p>
              )}
              {referralReason && (
                <>
                  <br />
                  <p><strong>Reason for Referral:</strong> {referralReason}</p>
                </>
              )}
              <br />
              <p>
                Your expert evaluation and management of this patient would be greatly appreciated. Please feel free to contact us for any additional clinical details.
              </p>
              <br />
              <div className="signature-block">
                <p>Yours sincerely,</p>
                <br /><br />
                <p><strong>{consultation?.doctorName ?? "_______________"}</strong></p>
                <p>{(clinicSettings as unknown as Record<string, string> | undefined)?.clinicName ?? ""}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowReferralLetter(false)}>Close</Button>
              <Button onClick={() => handlePrintLetter("referral-letter-content", "Referral Letter")}>
                <Printer className="mr-2 h-4 w-4" /> Print Letter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
