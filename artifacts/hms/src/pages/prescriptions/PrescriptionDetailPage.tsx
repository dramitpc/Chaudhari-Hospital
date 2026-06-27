import { useRoute, useLocation, useSearch } from "wouter";
import { useEffect, useRef, useState } from "react";
import { fmtDate, calcAge } from "@/lib/dateUtils";
import {
  useGetPrescription, useGetClinicSettings, useGetPatient, useGetConsultation, useTranslatePrescription,
  getGetPrescriptionQueryKey, getGetClinicSettingsQueryKey, getGetPatientQueryKey, getGetConsultationQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Printer, Settings2, Share2, Languages, Loader2 } from "lucide-react";
import ShareDialog from "@/components/ShareDialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type PrescriptionItem = {
  drugName: string;
  genericName?: string | null;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string | null;
  quantity?: number | null;
};

type TranslatedData = {
  language: string;
  languageName: string;
  diagnosis?: string | null;
  advice?: string | null;
  notes?: string | null;
  items?: PrescriptionItem[];
};

type RxFormat = {
  showDiagnosis: boolean;
  showSoap: boolean;
  showInvestigations: boolean;
  showAdvice: boolean;
  showFollowUp: boolean;
  showReferenceTo: boolean;
  showGenericName: boolean;
  showInstructions: boolean;
  drugStyle: "table" | "list";
  headerAlign: "left" | "center";
  paperSize: "a4" | "a5" | "letter";
  fontSize: "sm" | "md" | "lg";
  displayMode: "english" | "translated" | "bilingual";
};

const DEFAULT_FORMAT: RxFormat = {
  showDiagnosis: true,
  showSoap: false,
  showInvestigations: true,
  showAdvice: true,
  showFollowUp: true,
  showReferenceTo: true,
  showGenericName: true,
  showInstructions: true,
  drugStyle: "table",
  headerAlign: "center",
  paperSize: "a4",
  fontSize: "sm",
  displayMode: "bilingual",
};

const LS_KEY = "clinicos_rx_format_v2";

function loadFormat(): RxFormat {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULT_FORMAT, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_FORMAT };
}

const PAPER_MAX: Record<RxFormat["paperSize"], string> = {
  a4: "max-w-2xl", a5: "max-w-sm", letter: "max-w-3xl",
};

const FONT_SIZE: Record<RxFormat["fontSize"], string> = {
  sm: "text-sm", md: "text-base", lg: "text-lg",
};

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "mr", label: "मराठी (Marathi)" },
  { code: "gu", label: "ગુજરાતી (Gujarati)" },
  { code: "ta", label: "தமிழ் (Tamil)" },
  { code: "te", label: "తెలుగు (Telugu)" },
  { code: "kn", label: "ಕನ್ನಡ (Kannada)" },
  { code: "pa", label: "ਪੰਜਾਬੀ (Punjabi)" },
  { code: "bn", label: "বাংলা (Bengali)" },
];

// Dual-row display for bilingual mode
function BilingualField({ label, en: enVal, translated }: { label: string; en?: string | null; translated?: string | null }) {
  if (!enVal && !translated) return null;
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      {enVal && <p className="text-sm">{enVal}</p>}
      {translated && translated !== enVal && (
        <p className="text-sm mt-0.5 text-blue-700 dark:text-blue-400" style={{ fontFamily: "'Noto Sans', sans-serif" }}>{translated}</p>
      )}
    </div>
  );
}

export default function PrescriptionDetailPage() {
  const [, params] = useRoute("/prescriptions/:id");
  const id = params?.id ?? "";
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: prescription, isLoading } = useGetPrescription(id, {
    query: { enabled: !!id, queryKey: getGetPrescriptionQueryKey(id) }
  });
  const { data: settings } = useGetClinicSettings({ query: { queryKey: getGetClinicSettingsQueryKey() } });
  const patientId = prescription?.patientId ?? "";
  const { data: patient } = useGetPatient(patientId, {
    query: { enabled: !!patientId, queryKey: getGetPatientQueryKey(patientId) }
  });
  const consultationId = prescription?.consultationId ?? "";
  const { data: consultation } = useGetConsultation(consultationId, {
    query: { enabled: !!consultationId, queryKey: getGetConsultationQueryKey(consultationId) }
  });
  // Parse URL params once (search is a stable string from wouter)
  const urlLang = new URLSearchParams(search).get("lang") ?? "";
  const urlMode = (new URLSearchParams(search).get("mode") ?? "") as RxFormat["displayMode"] | "";
  const isPrintFlow = new URLSearchParams(search).get("print") === "1";

  const [fmt, setFmt] = useState<RxFormat>(() => {
    const base = loadFormat();
    return urlMode ? { ...base, displayMode: urlMode as RxFormat["displayMode"] } : base;
  });
  const [showShare, setShowShare] = useState(false);
  const [selectedLang, setSelectedLang] = useState(() => (urlLang && urlLang !== "en") ? urlLang : "en");
  const translateMutation = useTranslatePrescription();
  const didAutoPrint = useRef(false);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(fmt));
  }, [fmt]);

  // Auto-populate language from patient preference or existing translation
  // (URL lang param takes priority — skip when coming from print flow)
  useEffect(() => {
    if (urlLang) return;
    if (prescription?.patientLanguage && prescription.patientLanguage !== "en") {
      setSelectedLang(prescription.patientLanguage);
    } else if (patient?.preferredLanguage && patient.preferredLanguage !== "en") {
      setSelectedLang(patient.preferredLanguage);
    }
  }, [prescription?.patientLanguage, patient?.preferredLanguage, urlLang]);

  const printRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof RxFormat>(key: K, value: RxFormat[K]) =>
    setFmt(prev => ({ ...prev, [key]: value }));

  // Fit-to-A4: shrink via zoom if content overflows one page
  useEffect(() => {
    const A4_PX = 1047; // 297mm − 2×10mm margins at 96 dpi
    const before = () => {
      const el = printRef.current;
      if (!el) return;
      el.style.zoom = "";
      const h = el.scrollHeight;
      if (h > A4_PX) el.style.zoom = String(A4_PX / h);
    };
    const after = () => {
      if (printRef.current) printRef.current.style.zoom = "";
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);

  // Auto-print: translate first when a lang was passed, then print
  useEffect(() => {
    if (!isLoading && prescription && isPrintFlow && !didAutoPrint.current) {
      didAutoPrint.current = true;
      if (urlLang && urlLang !== "en") {
        translateMutation.mutate(
          { id, data: { language: urlLang, displayMode: (urlMode || "bilingual") as RxFormat["displayMode"] } },
          {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: getGetPrescriptionQueryKey(id) });
              setTimeout(() => window.print(), 400);
            },
            onError: () => setTimeout(() => window.print(), 400),
          }
        );
      } else {
        setTimeout(() => window.print(), 300);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, prescription]);

  const handleTranslate = () => {
    if (!id || !selectedLang || selectedLang === "en") return;
    translateMutation.mutate(
      { id, data: { language: selectedLang, displayMode: fmt.displayMode } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPrescriptionQueryKey(id) });
          toast({ title: "Translation complete", description: `Prescription translated to ${LANGUAGES.find(l => l.code === selectedLang)?.label}` });
        },
        onError: () => toast({ title: "Translation failed", description: "Please try again", variant: "destructive" }),
      }
    );
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!prescription) return <div className="text-center py-8 text-muted-foreground">Prescription not found</div>;

  const items = (prescription.items ?? []) as PrescriptionItem[];
  const translatedData = prescription.translations as TranslatedData | null;
  const hasTranslation = !!translatedData?.language && translatedData.language !== "en";
  const textAlign = fmt.headerAlign === "center" ? "text-center" : "text-left";
  const showTranslated = fmt.displayMode !== "english" && hasTranslation;
  const showEnglish = fmt.displayMode !== "translated" || !hasTranslation;
  const isBilingual = fmt.displayMode === "bilingual" && hasTranslation;

  const displayItems = (showTranslated && translatedData?.items) ? translatedData.items : items;

  const rxShareMessage = (() => {
    const clinic = settings?.clinicName ?? "ClinicOS";
    const lines: string[] = [];
    lines.push(`*Prescription — ${clinic}*`);
    if (settings?.phone) lines.push(settings.phone);
    lines.push("");
    lines.push(`Patient: ${prescription.patientName}`);
    lines.push(`Date: ${fmtDate(prescription.visitDate)}`);
    lines.push(`Doctor: Dr. ${prescription.doctorName}`);
    if (prescription.diagnosis) { lines.push(""); lines.push(`Diagnosis: ${prescription.diagnosis}`); }
    lines.push("");
    lines.push("*Medicines:*");
    items.forEach((item, i) => {
      let drug = `${i + 1}. ${item.drugName}`;
      if (item.genericName) drug += ` (${item.genericName})`;
      drug += ` — ${item.dosage}, ${item.frequency}, ${item.duration}`;
      if (item.instructions) drug += `\n   ${item.instructions}`;
      lines.push(drug);
    });
    if (prescription.advice) { lines.push(""); lines.push(`Advice: ${prescription.advice}`); }
    if (hasTranslation && translatedData?.advice) lines.push(translatedData.advice);
    if (prescription.followUpDate) { lines.push(""); lines.push(`Follow-up: ${fmtDate(prescription.followUpDate)}`); }
    lines.push("");
    lines.push(`Thank you for visiting ${clinic}!`);
    return lines.join("\n");
  })();

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 print:hidden">
        <Button variant="ghost" size="icon" onClick={() => setLocation(new URLSearchParams(search).get("from") === "prescriptions" ? "/prescriptions" : prescription?.consultationId ? `/consultations/${prescription.consultationId}` : "/prescriptions")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowShare(true)}>
            <Share2 className="h-4 w-4 mr-1.5" />Share
          </Button>

          {/* Language & Translation Controls */}
          <div className="flex items-center gap-1.5 border border-border rounded-md px-2 py-1">
            <Languages className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Select value={selectedLang} onValueChange={setSelectedLang}>
              <SelectTrigger className="border-0 h-7 text-sm p-0 focus:ring-0 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(l => (
                  <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs px-2"
              onClick={handleTranslate}
              disabled={selectedLang === "en" || translateMutation.isPending}
              data-testid="btn-translate"
            >
              {translateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Translate"}
            </Button>
          </div>

          {/* Display mode toggle — always shown so user can switch back */}
          <div className="flex items-center gap-1 border border-border rounded-md p-0.5">
            {(["english", "translated", "bilingual"] as const).map(mode => (
              <button
                key={mode}
                onClick={() => set("displayMode", mode)}
                disabled={!hasTranslation && mode !== "english"}
                className={`text-xs px-2.5 py-1 rounded transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed ${
                  fmt.displayMode === mode && (hasTranslation || mode === "english")
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode === "english" ? "EN" : mode === "translated" ? translatedData?.languageName?.slice(0, 2).toUpperCase() ?? "TR" : "Bilingual"}
              </button>
            ))}
          </div>

          {/* Format popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="h-4 w-4 mr-1.5" />Format
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-4 space-y-4">
              <p className="text-sm font-semibold">Prescription Format</p>
              <Separator />
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sections</p>
                {([
                  { key: "showDiagnosis",       label: "Diagnosis"           },
                  { key: "showSoap",            label: "SOAP notes"          },
                  { key: "showInvestigations",  label: "Investigations"      },
                  { key: "showGenericName",     label: "Generic drug name"   },
                  { key: "showInstructions",    label: "Instructions column" },
                  { key: "showAdvice",          label: "Advice"              },
                  { key: "showFollowUp",        label: "Follow-up date"      },
                  { key: "showReferenceTo",     label: "Reference to"        },
                ] as { key: keyof RxFormat; label: string }[]).map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label className="text-sm font-normal cursor-pointer" htmlFor={`fmt-${key}`}>{label}</Label>
                    <Switch id={`fmt-${key}`} checked={fmt[key] as boolean} onCheckedChange={v => set(key, v as RxFormat[typeof key])} />
                  </div>
                ))}
              </div>
              <Separator />
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Drug list style</Label>
                <Select value={fmt.drugStyle} onValueChange={v => set("drugStyle", v as RxFormat["drugStyle"])}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="table">Table</SelectItem>
                    <SelectItem value="list">Rx list (narrative)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Header alignment</Label>
                <Select value={fmt.headerAlign} onValueChange={v => set("headerAlign", v as RxFormat["headerAlign"])}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="center">Centre</SelectItem>
                    <SelectItem value="left">Left</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Paper size</Label>
                <Select value={fmt.paperSize} onValueChange={v => set("paperSize", v as RxFormat["paperSize"])}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4">A4</SelectItem>
                    <SelectItem value="a5">A5 (half-sheet)</SelectItem>
                    <SelectItem value="letter">Letter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Font size</Label>
                <Select value={fmt.fontSize} onValueChange={v => set("fontSize", v as RxFormat["fontSize"])}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sm">Small</SelectItem>
                    <SelectItem value="md">Medium</SelectItem>
                    <SelectItem value="lg">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>

          <Button onClick={() => window.print()} data-testid="btn-print-prescription">
            <Printer className="mr-2 h-4 w-4" />Print
          </Button>
        </div>
      </div>

      {/* Translation status banner */}
      {hasTranslation && (
        <div className="mb-3 flex items-center gap-2 print:hidden">
          <Badge variant="secondary" className="text-xs gap-1">
            <Languages className="h-3 w-3" />
            {translatedData?.languageName} translation available
          </Badge>
          <span className="text-xs text-muted-foreground">Display mode: {fmt.displayMode}</span>
        </div>
      )}

      {/* Prescription body */}
      <div ref={printRef} className={`mx-auto bg-white dark:bg-card rounded-lg border border-border p-8 print:border-0 print:shadow-none print:max-w-full print:p-4 ${PAPER_MAX[fmt.paperSize]} ${FONT_SIZE[fmt.fontSize]}`}>
        {/* Indic font preload */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600&family=Noto+Sans+Devanagari:wght@400;500&family=Noto+Sans+Gujarati:wght@400;500&family=Noto+Sans+Tamil:wght@400;500&family=Noto+Sans+Telugu:wght@400;500&family=Noto+Sans+Kannada:wght@400;500&family=Noto+Sans+Bengali:wght@400;500&family=Noto+Sans+Gurmukhi:wght@400;500&display=swap" />

        {/* Letterhead */}
        <div className="border-b-2 border-primary pb-4 mb-6 flex items-start justify-between gap-4">
          <div className={`flex-1 ${textAlign}`}>
            <h1 className="text-2xl font-bold text-primary">{settings?.clinicName ?? "Hospital"}</h1>
            {settings?.address && <p className="text-sm text-muted-foreground">{settings.address}</p>}
            {settings?.phone && <p className="text-sm text-muted-foreground">Tel: {settings.phone}</p>}
            {settings?.email && <p className="text-sm text-muted-foreground">{settings.email}</p>}
            {settings?.website && <p className="text-sm text-muted-foreground">{settings.website}</p>}
            {settings?.registrationNumber && <p className="text-xs text-muted-foreground">Reg: {settings.registrationNumber}</p>}
          </div>
          <div className="flex-1 text-right">
            <p className="text-base font-semibold text-foreground">Dr. {prescription.doctorName}</p>
            {prescription.doctorSpecialization && (
              <p className="text-sm text-muted-foreground">{prescription.doctorSpecialization}</p>
            )}
          </div>
        </div>

        {prescription.doctorConsultingHours && (
          <div className="-mt-4 mb-0 text-center">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Consulting Hours:</span>&ensp;{prescription.doctorConsultingHours}
            </p>
          </div>
        )}

        <div className="mt-0.5 mb-4 text-right">
          <p className="text-sm text-muted-foreground">Date: {fmtDate(prescription.visitDate)}</p>
        </div>

        {(() => {
          const genderMap: Record<string, string> = { male: "M", female: "F", other: "O" };
          const genderCode = (patient?.gender ? genderMap[patient.gender] : undefined) ?? "—";
          const ageValue = String(calcAge(patient?.dateOfBirth) ?? patient?.age ?? "—");
          const fields: { label: string; value: string; cls: string }[] = [
            { label: "Patient Name", value: prescription.patientName ?? "—",  cls: "flex-[3] min-w-0" },
            { label: "Patient ID",   value: patient?.patientId ?? "—",        cls: "flex-none w-24 shrink-0" },
            { label: "Age",          value: ageValue,                          cls: "flex-none w-16 shrink-0" },
            { label: "Sex",          value: genderCode,                                                                              cls: "flex-none w-10 shrink-0" },
            ...(consultation?.visitType ? [{ label: "Visit Type", value: consultation.visitType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), cls: "flex-1 min-w-0" }] : []),
            ...(patient?.address        ? [{ label: "Address",    value: patient.address,                                            cls: "flex-[2] min-w-0" }] : []),
          ];
          return (
            <div className="flex items-stretch mb-6 border border-border rounded overflow-hidden bg-muted/30 w-full">
              {fields.map((field, idx) => (
                <div key={field.label} className={`${field.cls} px-3 py-2 flex items-center ${idx < fields.length - 1 ? "border-r border-border" : ""}`}>
                  <p className={`text-sm font-medium ${field.label === "Patient Name" ? "whitespace-normal" : "truncate"}`}>{field.value}</p>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Known Allergies */}
        {patient?.allergies && (
          <div className="flex items-start gap-2 mb-4 px-3 py-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300">
            <span className="text-xs font-bold uppercase tracking-wide shrink-0 mt-0.5">⚠ Allergies:</span>
            <span className="text-xs">{patient.allergies}</span>
          </div>
        )}

        {/* SOAP */}
        {fmt.showSoap && (prescription.soapSubjective || prescription.soapObjective || prescription.soapAssessment || prescription.soapPlan) && (
          <div className="mb-4 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SOAP Notes</p>
            {prescription.chiefComplaint && <p className="text-sm whitespace-pre-wrap"><span className="font-medium">CC: </span>{prescription.chiefComplaint}</p>}
            {prescription.soapSubjective && <p className="text-sm whitespace-pre-wrap"><span className="font-medium">S: </span>{prescription.soapSubjective}</p>}
            {prescription.soapObjective && <p className="text-sm whitespace-pre-wrap"><span className="font-medium">O: </span>{prescription.soapObjective}</p>}
            {prescription.soapAssessment && <p className="text-sm whitespace-pre-wrap"><span className="font-medium">A: </span>{prescription.soapAssessment}</p>}
            {prescription.soapPlan && <p className="text-sm whitespace-pre-wrap"><span className="font-medium">P: </span>{prescription.soapPlan}</p>}
          </div>
        )}

        {fmt.showInvestigations && (() => {
          const QUEUE_MARKER = "\n\u200B\u200B";
          const raw = consultation?.investigationOrders ?? prescription.investigationOrders ?? "";
          const invText = raw.replaceAll(QUEUE_MARKER, "\n");
          return invText.trim() ? (
            <div className="mb-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Investigations</p>
              <p className="text-sm whitespace-pre-wrap">{invText.trim()}</p>
            </div>
          ) : null;
        })()}

        {/* Diagnosis — always English */}
        {fmt.showDiagnosis && prescription.diagnosis && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Diagnosis</p>
            <p className="text-sm whitespace-pre-wrap">{prescription.diagnosis}</p>
          </div>
        )}

        {/* Drug list */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Rx — Medications</p>
          {fmt.drugStyle === "table" ? (
            <table className="w-full text-sm border border-border rounded">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium">#</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">Drug Name</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">Dosage</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">Frequency</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">Duration</th>
                  {fmt.showInstructions && <th className="px-3 py-2 text-left text-xs font-medium">Instructions</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const tr = translatedData?.items?.[i];
                  return (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">
                        {item.drugName}
                        {fmt.showGenericName && item.genericName && (
                          <span className="block text-xs text-muted-foreground">({item.genericName})</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {showEnglish && <span>{item.dosage}</span>}
                        {isBilingual && tr?.dosage && tr.dosage !== item.dosage && <span className="block text-blue-700 dark:text-blue-400" style={{ fontFamily: "'Noto Sans', sans-serif" }}>{tr.dosage}</span>}
                        {!showEnglish && showTranslated && <span style={{ fontFamily: "'Noto Sans', sans-serif" }}>{tr?.dosage ?? item.dosage}</span>}
                      </td>
                      <td className="px-3 py-2">
                        {showEnglish && <span>{item.frequency}</span>}
                        {isBilingual && tr?.frequency && tr.frequency !== item.frequency && <span className="block text-blue-700 dark:text-blue-400" style={{ fontFamily: "'Noto Sans', sans-serif" }}>{tr.frequency}</span>}
                        {!showEnglish && showTranslated && <span style={{ fontFamily: "'Noto Sans', sans-serif" }}>{tr?.frequency ?? item.frequency}</span>}
                      </td>
                      <td className="px-3 py-2">
                        {showEnglish && <span>{item.duration}</span>}
                        {isBilingual && tr?.duration && tr.duration !== item.duration && <span className="block text-blue-700 dark:text-blue-400" style={{ fontFamily: "'Noto Sans', sans-serif" }}>{tr.duration}</span>}
                        {!showEnglish && showTranslated && <span style={{ fontFamily: "'Noto Sans', sans-serif" }}>{tr?.duration ?? item.duration}</span>}
                      </td>
                      {fmt.showInstructions && (
                        <td className="px-3 py-2 text-muted-foreground">
                          {showEnglish && <span>{item.instructions ?? "—"}</span>}
                          {isBilingual && tr?.instructions && tr.instructions !== item.instructions && <span className="block text-blue-700 dark:text-blue-400" style={{ fontFamily: "'Noto Sans', sans-serif" }}>{tr.instructions}</span>}
                          {!showEnglish && showTranslated && <span style={{ fontFamily: "'Noto Sans', sans-serif" }}>{tr?.instructions ?? item.instructions ?? "—"}</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <ol className="space-y-2 list-none">
              {(isBilingual ? items : displayItems).map((item, i) => {
                const tr = translatedData?.items?.[i];
                const showTrLine = isBilingual && tr;
                return (
                  <li key={i} className="flex gap-3 items-start border-b border-border/50 pb-2 last:border-0">
                    <span className="font-bold text-primary min-w-[1.25rem]">{i + 1}.</span>
                    <div className="flex-1">
                      <span className="font-semibold">{item.drugName}</span>
                      {fmt.showGenericName && item.genericName && (
                        <span className="text-xs text-muted-foreground ml-1">({item.genericName})</span>
                      )}
                      {showEnglish && <span className="text-muted-foreground"> — {item.dosage}, {item.frequency}, {item.duration}</span>}
                      {showTrLine && (
                        <p className="text-blue-700 dark:text-blue-400 mt-0.5" style={{ fontFamily: "'Noto Sans', sans-serif" }}>
                          {tr.dosage}, {tr.frequency}, {tr.duration}
                        </p>
                      )}
                      {!showEnglish && showTranslated && tr && (
                        <span className="text-muted-foreground" style={{ fontFamily: "'Noto Sans', sans-serif" }}> — {tr.dosage}, {tr.frequency}, {tr.duration}</span>
                      )}
                      {fmt.showInstructions && item.instructions && showEnglish && (
                        <p className="text-xs text-muted-foreground mt-0.5 italic">{item.instructions}</p>
                      )}
                      {fmt.showInstructions && showTrLine && tr.instructions && tr.instructions !== item.instructions && (
                        <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5 italic" style={{ fontFamily: "'Noto Sans', sans-serif" }}>{tr.instructions}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Prescribed Orthotics */}
        {(() => {
          let orthotics: string[] = [];
          try { const p = prescription.notes ? JSON.parse(prescription.notes) : []; if (Array.isArray(p)) orthotics = p; } catch { /* not JSON */ }
          if (orthotics.length === 0) return null;
          return (
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0">🦴 Orthotics:</span>
              {orthotics.map(item => (
                <span key={item} className="text-sm border border-border rounded-full px-2.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300">
                  {item}
                </span>
              ))}
            </div>
          );
        })()}

        {/* Advice */}
        {fmt.showAdvice && (prescription.advice || translatedData?.advice) && (
          isBilingual ? (
            <BilingualField label="Advice" en={prescription.advice} translated={translatedData?.advice} />
          ) : (
            <div className="mb-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Advice</p>
              <p className="text-sm" style={showTranslated ? { fontFamily: "'Noto Sans', sans-serif" } : {}}>
                {showTranslated ? (translatedData?.advice ?? prescription.advice) : prescription.advice}
              </p>
            </div>
          )
        )}

        {/* Follow-up */}
        {fmt.showFollowUp && prescription.followUpDate && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Follow-up</p>
            <p className="text-sm">{fmtDate(prescription.followUpDate)}</p>
          </div>
        )}

        {/* Reference To */}
        {fmt.showReferenceTo && prescription.referenceTo && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reference To</p>
            <p className="text-sm">{prescription.referenceTo}</p>
          </div>
        )}

        <div className="mt-12 text-right">
          <div className="inline-block min-w-[180px]">
            {prescription.doctorSignatureData && (
              <img
                src={prescription.doctorSignatureData}
                alt="Doctor signature"
                className="h-14 max-w-[200px] object-contain ml-auto mb-1"
              />
            )}
            <p className="text-sm font-medium">Dr. {prescription.doctorName}</p>
            {prescription.doctorRegistrationNumber && (
              <p className="text-xs text-muted-foreground">Reg. No: {prescription.doctorRegistrationNumber}</p>
            )}
            <p className="text-xs text-muted-foreground">Signature &amp; Stamp</p>
          </div>
        </div>

      </div>

      <style>{`
        @page {
          size: A4;
          margin: 1cm;
        }
        @media print {
          .print\\:hidden { display: none !important; }
          nav, aside, header { display: none !important; }
          body { margin: 0 !important; }
          /* Tighten spacing so short content stays compact */
          .rx-section { margin-bottom: 0.5rem !important; }
          .rx-section-title { margin-bottom: 0.25rem !important; font-size: 0.7rem !important; }
          .rx-item { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
        }
      `}</style>

      <ShareDialog
        open={showShare}
        onOpenChange={setShowShare}
        patientName={prescription.patientName ?? "Patient"}
        patientPhone={patient?.phone}
        patientEmail={patient?.email}
        message={rxShareMessage}
        emailSubject={`Prescription — ${settings?.clinicName ?? "ClinicOS"}`}
      />
    </div>
  );
}
