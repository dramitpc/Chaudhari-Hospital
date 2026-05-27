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
import { FieldFavPanel } from "@/components/FieldFavPanel";
import { trackFieldRecent } from "@/lib/favUtils";

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

  // ── Diagnosis & Advice controlled state ───────────────────────────────────
  const [diagnosisValue, setDiagnosisValue] = useState("");
  const [adviceValue, setAdviceValue] = useState("");
  const [diagAdvInit, setDiagAdvInit] = useState(false);

  useEffect(() => {
    if (consultation && !diagAdvInit) {
      setDiagnosisValue(consultation.diagnosis ?? "");
      setAdviceValue(consultation.advice ?? "");
      setDiagAdvInit(true);
    }
  }, [consultation, diagAdvInit]);

  // ── Medical History controlled state ──────────────────────────────────────
  type MedHistField = "allergies" | "medicalHistory" | "surgicalHistory" | "familyHistory" | "currentMedications";
  const [medHistValues, setMedHistValues] = useState<Record<MedHistField, string>>({
    allergies: "", medicalHistory: "", surgicalHistory: "", familyHistory: "", currentMedications: ""
  });
  const [medHistInit, setMedHistInit] = useState(false);

  useEffect(() => {
    if (patient && !medHistInit) {
      setMedHistValues({
        allergies:          (patient as unknown as Record<string, string | null>).allergies          ?? "",
        medicalHistory:     (patient as unknown as Record<string, string | null>).medicalHistory     ?? "",
        surgicalHistory:    (patient as unknown as Record<string, string | null>).surgicalHistory    ?? "",
        familyHistory:      (patient as unknown as Record<string, string | null>).familyHistory      ?? "",
        currentMedications: (patient as unknown as Record<string, string | null>).currentMedications ?? "",
      });
      setMedHistInit(true);
    }
  }, [patient, medHistInit]);

  // ── Clinical Notes + Investigation controlled state ───────────────────────
  type ClinicalField = "chiefComplaint" | "historyOfPresentIllness" | "clinicalNotes" | "followUpNotes";
  const [clinicalValues, setClinicalValues] = useState<Record<ClinicalField, string>>({
    chiefComplaint: "", historyOfPresentIllness: "", clinicalNotes: "", followUpNotes: ""
  });
  const [investigationValue, setInvestigationValue] = useState("");
  const [clinicalInit, setClinicalInit] = useState(false);

  useEffect(() => {
    if (consultation && !clinicalInit) {
      setClinicalValues({
        chiefComplaint:          consultation.chiefComplaint          ?? "",
        historyOfPresentIllness: consultation.historyOfPresentIllness ?? "",
        clinicalNotes:           consultation.clinicalNotes           ?? "",
        followUpNotes:           consultation.followUpNotes           ?? "",
      });
      setInvestigationValue(consultation.investigationOrders ?? "");
      setClinicalInit(true);
    }
  }, [consultation, clinicalInit]);

  // ── Prescription templates ─────────────────────────────────────────────────
  type RxTemplate = { id: string; name: string; items: DrugItem[]; savedAt: number };
  const [showRxTemplatePanel, setShowRxTemplatePanel] = useState(false);
  const [rxFavName, setRxFavName] = useState("");
  const [, forceRxRefresh] = useState(0);

  const LS_RX_FAV    = "clinicos_rx_fav";
  const LS_RX_RECENT = "clinicos_rx_recent";
  const getRxFavs    = (): RxTemplate[] => JSON.parse(localStorage.getItem(LS_RX_FAV)    ?? "[]");
  const getRxRecent  = (): RxTemplate[] => JSON.parse(localStorage.getItem(LS_RX_RECENT) ?? "[]");
  const persistRxFavs    = (list: RxTemplate[]) => { localStorage.setItem(LS_RX_FAV,    JSON.stringify(list)); forceRxRefresh(n => n + 1); };
  const persistRxRecent  = (list: RxTemplate[]) => { localStorage.setItem(LS_RX_RECENT, JSON.stringify(list)); forceRxRefresh(n => n + 1); };

  const applyRxTemplate = (tpl: RxTemplate) => {
    setDrugItems(tpl.items.map(i => ({ ...i })));
    setShowRxTemplatePanel(false);
    toast({ title: "Prescription template applied" });
  };

  const saveRxFav = () => {
    if (!rxFavName.trim()) return;
    if (!drugItems.some(i => i.drugName.trim())) {
      toast({ title: "Add at least one drug first", variant: "destructive" }); return;
    }
    persistRxFavs([...getRxFavs(), { id: Date.now().toString(), name: rxFavName.trim(), items: drugItems, savedAt: Date.now() }]);
    setRxFavName("");
    toast({ title: "Saved as prescription template" });
  };

  const trackRxRecent = () => {
    if (!drugItems.some(i => i.drugName.trim())) return;
    const deduped = getRxRecent().slice(0, 4);
    persistRxRecent([{ id: Date.now().toString(), name: "", items: drugItems, savedAt: Date.now() }, ...deduped]);
  };

  const rxTemplateLabel = (t: RxTemplate) =>
    t.name || t.items.filter(i => i.drugName).map(i => i.drugName).join(", ").slice(0, 50) || "Untitled";
  // ──────────────────────────────────────────────────────────────────────────

  // ── SOAP per-field favourites & recent ───────────────────────────────────
  type SoapEntry = { id: string; name: string; value: string; savedAt: number };
  const SOAP_FIELDS = ["soapSubjective", "soapObjective", "soapAssessment", "soapPlan"] as const;
  type SoapField = typeof SOAP_FIELDS[number];

  const [soapValues, setSoapValues] = useState<Record<SoapField, string>>({
    soapSubjective: "", soapObjective: "", soapAssessment: "", soapPlan: ""
  });
  const [soapInitialized, setSoapInitialized] = useState(false);
  const [activeFieldPanel, setActiveFieldPanel] = useState<SoapField | null>(null);
  const [fieldFavName, setFieldFavName] = useState("");
  const [, forceRefresh] = useState(0);

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

  const lsFavKey    = (f: SoapField) => `clinicos_soap_fav_${f}`;
  const lsRecentKey = (f: SoapField) => `clinicos_soap_recent_${f}`;
  const getFieldFavs    = (f: SoapField): SoapEntry[] => JSON.parse(localStorage.getItem(lsFavKey(f))    ?? "[]");
  const getFieldRecent  = (f: SoapField): SoapEntry[] => JSON.parse(localStorage.getItem(lsRecentKey(f)) ?? "[]");
  const persistFieldFav    = (f: SoapField, list: SoapEntry[]) => { localStorage.setItem(lsFavKey(f),    JSON.stringify(list)); forceRefresh(n => n + 1); };
  const persistFieldRecent = (f: SoapField, list: SoapEntry[]) => { localStorage.setItem(lsRecentKey(f), JSON.stringify(list)); forceRefresh(n => n + 1); };

  const handleSoapChange = (field: SoapField, value: string) =>
    setSoapValues(prev => ({ ...prev, [field]: value }));

  const handleSoapBlur = (field: SoapField, value: string) => {
    handleBlur(field, value);
    if (!value.trim()) return;
    const deduped = getFieldRecent(field).filter(r => r.value !== value).slice(0, 4);
    persistFieldRecent(field, [{ id: Date.now().toString(), name: "", value, savedAt: Date.now() }, ...deduped]);
  };

  const applyFieldValue = (field: SoapField, value: string) => {
    setSoapValues(prev => ({ ...prev, [field]: value }));
    handleBlur(field, value);
    setActiveFieldPanel(null);
    toast({ title: "Applied" });
  };

  const saveFieldFavourite = (field: SoapField) => {
    if (!fieldFavName.trim()) return;
    const value = soapValues[field];
    if (!value.trim()) { toast({ title: "Nothing to save — field is empty", variant: "destructive" }); return; }
    persistFieldFav(field, [...getFieldFavs(field), { id: Date.now().toString(), name: fieldFavName.trim(), value, savedAt: Date.now() }]);
    setFieldFavName("");
    toast({ title: "Saved to favourites" });
  };

  const deleteFieldFav    = (f: SoapField, id: string) => persistFieldFav(f,    getFieldFavs(f).filter(e => e.id !== id));
  const deleteFieldRecent = (f: SoapField, id: string) => persistFieldRecent(f, getFieldRecent(f).filter(e => e.id !== id));
  const entryLabel = (e: SoapEntry) => e.name || (e.value.slice(0, 50) + (e.value.length > 50 ? "…" : ""));
  // ─────────────────────────────────────────────────────────────────────────

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
    trackRxRecent();
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
            <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 items-center">
              <Label className="text-xs">Diagnosis</Label>
              <FieldFavPanel
                lsKey="clinicos_diag"
                currentValue={diagnosisValue}
                onApply={v => { setDiagnosisValue(v); handleBlur("diagnosis", v); }}
              />
              <Input
                className="col-span-full"
                value={diagnosisValue}
                onChange={e => setDiagnosisValue(e.target.value)}
                onBlur={e => { handleBlur("diagnosis", e.target.value); trackFieldRecent("clinicos_diag", e.target.value); }}
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
            <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 items-center">
              <Label className="text-xs">Advice</Label>
              <FieldFavPanel
                lsKey="clinicos_advice"
                currentValue={adviceValue}
                onApply={v => { setAdviceValue(v); handleBlur("advice", v); }}
              />
              <Textarea
                className="col-span-full"
                value={adviceValue}
                onChange={e => setAdviceValue(e.target.value)}
                onBlur={e => { handleBlur("advice", e.target.value); trackFieldRecent("clinicos_advice", e.target.value); }}
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

            <TabsContent value="soap" className="mt-4 space-y-4">
              {SOAP_FIELDS.map(field => {
                const labels: Record<string, string> = {
                  soapSubjective: "S — Subjective",
                  soapObjective:  "O — Objective",
                  soapAssessment: "A — Assessment",
                  soapPlan:       "P — Plan",
                };
                const sublabels: Record<string, string> = {
                  soapSubjective: "What the patient reports",
                  soapObjective:  "Examination findings",
                  soapAssessment: "Diagnosis, differential",
                  soapPlan:       "Treatment, investigations, follow-up",
                };
                const isOpen = activeFieldPanel === field;
                const favs   = getFieldFavs(field);
                const recent = getFieldRecent(field);

                return (
                  <div key={field} className="space-y-1">
                    {/* Label row with toggle button */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold">{labels[field]}</span>
                        <span className="text-xs text-muted-foreground ml-1">— {sublabels[field]}</span>
                      </div>
                      <Button
                        size="sm" variant={isOpen ? "secondary" : "ghost"}
                        className="h-6 gap-1 px-2 text-xs"
                        onClick={() => { setActiveFieldPanel(isOpen ? null : field); setFieldFavName(""); }}
                      >
                        <BookMarked className="h-3 w-3" />
                        {favs.length > 0 || recent.length > 0
                          ? `${favs.length} fav · ${recent.length} recent`
                          : "Favourites & Recent"}
                      </Button>
                    </div>

                    {/* Per-field panel */}
                    {isOpen && (
                      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3 text-xs">
                        {favs.length === 0 && recent.length === 0 && (
                          <p className="text-muted-foreground text-center py-1">
                            No entries yet — type in the field below and it will appear here automatically.
                          </p>
                        )}

                        {favs.length > 0 && (
                          <div className="space-y-1">
                            <p className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                              <Star className="h-3 w-3" /> Favourites
                            </p>
                            {favs.map(e => (
                              <div key={e.id} className="flex items-center gap-2 rounded border border-border bg-card px-2 py-1">
                                <span className="truncate flex-1 font-medium">{entryLabel(e)}</span>
                                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs shrink-0" onClick={() => applyFieldValue(field, e.value)}>Apply</Button>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => deleteFieldFav(field, e.id)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        {recent.length > 0 && (
                          <div className="space-y-1">
                            <p className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
                              <Clock className="h-3 w-3" /> Recently Used
                            </p>
                            {recent.map(e => (
                              <div key={e.id} className="flex items-center gap-2 rounded border border-border bg-card px-2 py-1">
                                <div className="flex-1 min-w-0">
                                  <span className="truncate block">{entryLabel(e)}</span>
                                  <span className="text-muted-foreground text-[10px]">
                                    {new Date(e.savedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs shrink-0" onClick={() => applyFieldValue(field, e.value)}>Apply</Button>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => deleteFieldRecent(field, e.id)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Save current as favourite */}
                        <div className="flex gap-1.5 pt-1 border-t border-border">
                          <Input
                            className="h-7 text-xs flex-1"
                            value={fieldFavName}
                            onChange={e => setFieldFavName(e.target.value)}
                            placeholder="Name this favourite…"
                            onKeyDown={e => e.key === "Enter" && saveFieldFavourite(field)}
                          />
                          <Button size="sm" className="h-7 px-3 text-xs" onClick={() => saveFieldFavourite(field)}>
                            <Star className="h-3 w-3 mr-1" /> Save
                          </Button>
                        </div>
                      </div>
                    )}

                    <Textarea
                      value={soapValues[field]}
                      onChange={e => handleSoapChange(field, e.target.value)}
                      onBlur={e => handleSoapBlur(field, e.target.value)}
                      rows={4}
                      placeholder={`Enter ${sublabels[field].toLowerCase()}…`}
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
                    { field: "allergies"         as MedHistField, label: "Known Allergies",       placeholder: "Drug allergies, food allergies, environmental triggers..." },
                    { field: "medicalHistory"    as MedHistField, label: "Past Medical History",  placeholder: "Chronic conditions, past illnesses, hospitalisations..." },
                    { field: "surgicalHistory"   as MedHistField, label: "Surgical History",      placeholder: "Previous surgeries, procedures, dates..." },
                    { field: "familyHistory"     as MedHistField, label: "Family History",        placeholder: "Hereditary conditions, family illnesses..." },
                    { field: "currentMedications"as MedHistField, label: "Current Medications",   placeholder: "Ongoing medications, dosages, duration..." },
                  ]).map(({ field, label, placeholder }) => (
                    <div key={field} className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 items-center">
                      <Label className="text-xs font-medium">{label}</Label>
                      <FieldFavPanel
                        lsKey={`clinicos_medh_${field}`}
                        currentValue={medHistValues[field]}
                        onApply={v => { setMedHistValues(prev => ({ ...prev, [field]: v })); handleMedHistBlur(field, v); }}
                      />
                      <Textarea
                        className="col-span-full"
                        value={medHistValues[field]}
                        onChange={e => setMedHistValues(prev => ({ ...prev, [field]: e.target.value }))}
                        onBlur={e => { handleMedHistBlur(field, e.target.value); trackFieldRecent(`clinicos_medh_${field}`, e.target.value); }}
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
              {([
                { field: "chiefComplaint"          as ClinicalField, label: "Chief Complaint",              rows: 1, placeholder: "Main presenting complaint",        isInput: true  },
                { field: "historyOfPresentIllness" as ClinicalField, label: "History of Present Illness",   rows: 4, placeholder: "Detailed illness history...",      isInput: false },
                { field: "clinicalNotes"           as ClinicalField, label: "Clinical Notes",               rows: 6, placeholder: "Additional clinical observations...", isInput: false },
                { field: "followUpNotes"           as ClinicalField, label: "Follow-up Notes",              rows: 3, placeholder: "Follow-up instructions...",        isInput: false },
              ]).map(({ field, label, rows, placeholder, isInput }) => (
                <div key={field} className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 items-center">
                  <Label className="text-xs">{label}</Label>
                  <FieldFavPanel
                    lsKey={`clinicos_clin_${field}`}
                    currentValue={clinicalValues[field]}
                    onApply={v => { setClinicalValues(prev => ({ ...prev, [field]: v })); handleBlur(field, v); }}
                  />
                  {isInput ? (
                    <Input
                      className="col-span-full"
                      value={clinicalValues[field]}
                      onChange={e => setClinicalValues(prev => ({ ...prev, [field]: e.target.value }))}
                      onBlur={e => { handleBlur(field, e.target.value); trackFieldRecent(`clinicos_clin_${field}`, e.target.value); }}
                      placeholder={placeholder}
                    />
                  ) : (
                    <Textarea
                      className="col-span-full"
                      value={clinicalValues[field]}
                      onChange={e => setClinicalValues(prev => ({ ...prev, [field]: e.target.value }))}
                      onBlur={e => { handleBlur(field, e.target.value); trackFieldRecent(`clinicos_clin_${field}`, e.target.value); }}
                      rows={rows}
                      placeholder={placeholder}
                    />
                  )}
                </div>
              ))}
            </TabsContent>

            <TabsContent value="investigation" className="mt-4 space-y-3">
              <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 items-center">
                <Label className="text-xs">Investigation Orders</Label>
                <FieldFavPanel
                  lsKey="clinicos_invest"
                  currentValue={investigationValue}
                  onApply={v => { setInvestigationValue(v); handleBlur("investigationOrders", v); }}
                />
                <Textarea
                  className="col-span-full"
                  value={investigationValue}
                  onChange={e => setInvestigationValue(e.target.value)}
                  onBlur={e => { handleBlur("investigationOrders", e.target.value); trackFieldRecent("clinicos_invest", e.target.value); }}
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
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle>Add Prescription</DialogTitle>
              <Button
                type="button" size="sm"
                variant={showRxTemplatePanel ? "secondary" : "outline"}
                className="h-7 gap-1.5 text-xs"
                onClick={() => { setShowRxTemplatePanel(v => !v); setRxFavName(""); }}
              >
                <BookMarked className="h-3 w-3" />
                {(() => { const f = getRxFavs().length; const r = getRxRecent().length; return f > 0 || r > 0 ? `${f} fav · ${r} recent` : "Templates"; })()}
              </Button>
            </div>
          </DialogHeader>

          {/* Template panel */}
          {showRxTemplatePanel && (() => {
            const favs   = getRxFavs();
            const recent = getRxRecent();
            return (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3 text-xs">
                {favs.length === 0 && recent.length === 0 && (
                  <p className="text-muted-foreground text-center py-1">
                    No templates yet — add drugs and save as a template to reuse them.
                  </p>
                )}

                {favs.length > 0 && (
                  <div className="space-y-1">
                    <p className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                      <Star className="h-3 w-3" /> Saved Templates
                    </p>
                    {favs.map(t => (
                      <div key={t.id} className="flex items-center gap-2 rounded border border-border bg-card px-2 py-1">
                        <span className="truncate flex-1 font-medium">{rxTemplateLabel(t)}</span>
                        <span className="text-muted-foreground shrink-0">{t.items.filter(i => i.drugName).length} drug(s)</span>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs shrink-0" onClick={() => applyRxTemplate(t)}>Apply</Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => persistRxFavs(getRxFavs().filter(f => f.id !== t.id))}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {recent.length > 0 && (
                  <div className="space-y-1">
                    <p className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
                      <Clock className="h-3 w-3" /> Recently Used
                    </p>
                    {recent.map(t => (
                      <div key={t.id} className="flex items-center gap-2 rounded border border-border bg-card px-2 py-1">
                        <div className="flex-1 min-w-0">
                          <span className="truncate block">{rxTemplateLabel(t)}</span>
                          <span className="text-muted-foreground text-[10px]">
                            {new Date(t.savedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {t.items.filter(i => i.drugName).length} drug(s)
                          </span>
                        </div>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs shrink-0" onClick={() => applyRxTemplate(t)}>Apply</Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => persistRxRecent(getRxRecent().filter(r => r.id !== t.id))}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-1.5 pt-1 border-t border-border">
                  <Input
                    className="h-7 text-xs flex-1"
                    value={rxFavName}
                    onChange={e => setRxFavName(e.target.value)}
                    placeholder="Name this template…"
                    onKeyDown={e => e.key === "Enter" && saveRxFav()}
                  />
                  <Button type="button" size="sm" className="h-7 px-3 text-xs" onClick={saveRxFav}>
                    <Star className="h-3 w-3 mr-1" /> Save
                  </Button>
                </div>
              </div>
            );
          })()}

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
