import { useRoute, useLocation, Link } from "wouter";
import { useState, useEffect, useRef } from "react";
import { fmtDate, fmtDateTime } from "@/lib/dateUtils";
import {
  useGetConsultation, useUpdateConsultation, useCompleteConsultation,
  useListPrescriptions, useCreatePrescription, useUpdatePrescription, useListDrugs,
  useGetPatient, useUpdatePatient, useGetClinicSettings, useGetPatientHistory, useListInvoices,
  useCreateInvoice, useUpdateInvoice, useRecordPayment, useListChargeTypes,
  useCreateInvestigation, useUpdateInvestigation, useListInvestigations,
  useTranslatePreviewPrescription,
  getGetConsultationQueryKey, getListPrescriptionsQueryKey, getListDrugsQueryKey, getGetPatientQueryKey, getGetClinicSettingsQueryKey, getGetPatientHistoryQueryKey, getListInvoicesQueryKey, getListInvestigationsQueryKey, getListChargeTypesQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle, Plus, Printer, FileText, Mail, Send, Star, Clock, X, BookMarked, ScanLine, ImageIcon, Paperclip, DollarSign, Receipt, Languages, Loader2 } from "lucide-react";
import { FieldFavPanel } from "@/components/FieldFavPanel";
import { trackFieldRecent } from "@/lib/favUtils";
import { InvestigationFavPanel, trackInvestigationRecent } from "@/components/InvestigationFavPanel";

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

const LS_DRUG_FREQ = "clinicos_drug_freq";
function getDrugFreq(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LS_DRUG_FREQ) ?? "{}"); } catch { return {}; }
}
function trackDrugFreq(drugIds: string[]) {
  const freq = getDrugFreq();
  for (const id of drugIds) freq[id] = (freq[id] ?? 0) + 1;
  try { localStorage.setItem(LS_DRUG_FREQ, JSON.stringify(freq)); } catch { /* ignore */ }
}

// ── Attachment helpers (shared with InvestigationsPage logic) ─────────────────
type Attachment = { name: string; data: string };

function parseAttachments(raw: string | null | undefined): Attachment[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Attachment[];
  } catch {}
  return [{ name: "attachment", data: raw }];
}

function isPdfData(dataUrl: string) {
  return dataUrl.startsWith("data:application/pdf");
}

function openInNewTab(dataUrl: string) {
  const win = window.open();
  if (win) {
    win.document.write(
      `<iframe src="${dataUrl}" style="width:100%;height:100%;border:none;margin:0;padding:0"/>`
    );
    win.document.close();
  }
}

const INV_STATUS_COLORS: Record<string, string> = {
  pending:     "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  completed:   "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  cancelled:   "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const INV_STATUS_LABELS: Record<string, string> = {
  pending: "Pending", in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled",
};
const RX_PREVIEW_LANGUAGES = [
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
// ─────────────────────────────────────────────────────────────────────────────

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
  const updatePrescriptionMutation = useUpdatePrescription();
  const updatePatientMutation = useUpdatePatient();
  const createInvestigationMutation = useCreateInvestigation();
  const createInvoiceMutation = useCreateInvoice();
  const updateInvoiceMutation = useUpdateInvoice();
  const recordPaymentMutation = useRecordPayment();
  const { data: chargeTypes } = useListChargeTypes({ query: { queryKey: getListChargeTypesQueryKey() } });

  const patientId = consultation?.patientId ?? "";
  const { data: patient } = useGetPatient(patientId, {
    query: { enabled: !!patientId, queryKey: getGetPatientQueryKey(patientId) }
  });
  const { data: clinicSettings } = useGetClinicSettings({ query: { queryKey: getGetClinicSettingsQueryKey() } });
  const { data: patientHistory } = useGetPatientHistory(patientId, {
    query: { enabled: !!patientId, queryKey: getGetPatientHistoryQueryKey(patientId) }
  });
  const { data: invoicesData } = useListInvoices(
    { patientId: patientId || undefined, limit: 100 },
    { query: { enabled: !!patientId, queryKey: getListInvoicesQueryKey({ patientId: patientId || undefined, limit: 100 }) } }
  );

  const [expandedVisit, setExpandedVisit] = useState<string | null>(null);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [editRxId, setEditRxId] = useState<string | null>(null);
  const [showRxPreview, setShowRxPreview] = useState(false);
  const [previewLang, setPreviewLang] = useState("mr");
  const [previewTranslation, setPreviewTranslation] = useState<{ languageName?: string; advice?: string | null; items?: { dosage?: string; frequency?: string; duration?: string; instructions?: string }[] } | null>(null);
  const [previewDisplayMode, setPreviewDisplayMode] = useState<"english" | "translated" | "bilingual">("bilingual");
  const translatePreviewMutation = useTranslatePreviewPrescription();
  const [selectedDrugIds, setSelectedDrugIds] = useState<Set<string>>(new Set());
  const [drugPickerSearch, setDrugPickerSearch] = useState("");
  const [drugItems, setDrugItems] = useState<DrugItem[]>([
    { drugName: "", dosage: "", frequency: "", duration: "", instructions: "" }
  ]);

  // ── Diagnosis & Advice controlled state ───────────────────────────────────
  const [diagnosisValue, setDiagnosisValue] = useState("");
  const [adviceValue, setAdviceValue] = useState("");
  const [referenceToValue, setReferenceToValue] = useState("");
  const [diagAdvInit, setDiagAdvInit] = useState(false);

  useEffect(() => {
    if (consultation && !diagAdvInit) {
      setDiagnosisValue(consultation.diagnosis ?? "");
      setAdviceValue(consultation.advice ?? "");
      setReferenceToValue(consultation.referenceTo ?? "");
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
  type ClinicalField = "referringDoctorName" | "chiefComplaint" | "historyOfPresentIllness" | "clinicalNotes" | "followUpNotes";
  const [clinicalValues, setClinicalValues] = useState<Record<ClinicalField, string>>({
    referringDoctorName: "", chiefComplaint: "", historyOfPresentIllness: "", clinicalNotes: "", followUpNotes: ""
  });
  const [investigationValue, setInvestigationValue] = useState("");
  const [clinicalInit, setClinicalInit] = useState(false);
  const [invImagePreview, setInvImagePreview] = useState<{ open: boolean; src: string; label: string }>({
    open: false, src: "", label: "",
  });

  // ── Clinical Attachments ──────────────────────────────────────────────────
  const clinicalAttachRef = useRef<HTMLInputElement>(null);
  const [clinicalAttachLoading, setClinicalAttachLoading] = useState(false);

  const handleClinicalFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const invalid = files.find(f => !f.type.startsWith("image/") && f.type !== "application/pdf");
    if (invalid) {
      toast({ title: "Only images and PDFs are allowed", variant: "destructive" });
      e.target.value = "";
      return;
    }
    const tooBig = files.find(f => f.size > 8 * 1024 * 1024);
    if (tooBig) {
      toast({ title: `${tooBig.name} exceeds the 8 MB limit`, variant: "destructive" });
      e.target.value = "";
      return;
    }

    setClinicalAttachLoading(true);
    try {
      const existing = parseAttachments(consultation?.clinicalAttachments);
      const newEntries: Attachment[] = await Promise.all(
        files.map(async f => ({
          name: f.name,
          data: await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(f);
          }),
        }))
      );
      const merged = [...existing, ...newEntries];
      await updateMutation.mutateAsync({
        id,
        data: { clinicalAttachments: JSON.stringify(merged) } as Parameters<typeof updateMutation.mutateAsync>[0]["data"],
      });
      toast({ title: `${newEntries.length} file${newEntries.length > 1 ? "s" : ""} attached` });
      queryClient.invalidateQueries({ queryKey: getGetConsultationQueryKey(id) });
    } catch {
      toast({ title: "Failed to attach files", variant: "destructive" });
    } finally {
      setClinicalAttachLoading(false);
      e.target.value = "";
    }
  };

  const handleRemoveClinicalAttachment = async (idx: number) => {
    const list = parseAttachments(consultation?.clinicalAttachments);
    const updated = list.filter((_, i) => i !== idx);
    try {
      await updateMutation.mutateAsync({
        id,
        data: { clinicalAttachments: updated.length ? JSON.stringify(updated) : "" } as Parameters<typeof updateMutation.mutateAsync>[0]["data"],
      });
      toast({ title: "Attachment removed" });
      queryClient.invalidateQueries({ queryKey: getGetConsultationQueryKey(id) });
    } catch {
      toast({ title: "Failed to remove attachment", variant: "destructive" });
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (consultation && !clinicalInit) {
      setClinicalValues({
        referringDoctorName:     consultation.referringDoctorName     ?? (patient?.referringDoctorName ?? ""),
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
  const [showRxTemplateDialog, setShowRxTemplateDialog] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
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
    setShowRxTemplateDialog(false);
    setSelectedTemplateIds(new Set());
    toast({ title: "Template applied" });
  };

  const applySelectedTemplates = () => {
    const allTemplates = [...getRxFavs(), ...getRxRecent()];
    const selected = allTemplates.filter(t => selectedTemplateIds.has(t.id));
    if (!selected.length) return;
    const seen = new Set<string>();
    const merged: DrugItem[] = [];
    for (const tpl of selected) {
      for (const item of tpl.items) {
        if (!item.drugName.trim()) continue;
        const key = item.drugName.toLowerCase();
        if (!seen.has(key)) { seen.add(key); merged.push({ ...item }); }
      }
    }
    setDrugItems(merged.length > 0 ? merged : [{ drugName: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
    setSelectedTemplateIds(new Set());
    setShowRxTemplateDialog(false);
    toast({ title: `${selected.length} template${selected.length > 1 ? "s" : ""} applied` });
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
    const deduped = getRxRecent().slice(0, 8);
    persistRxRecent([{ id: Date.now().toString(), name: "", items: drugItems, savedAt: Date.now() }, ...deduped]);
  };

  const rxTemplateLabel = (t: RxTemplate) =>
    t.name || t.items.filter(i => i.drugName).map(i => i.drugName).join(", ").slice(0, 50) || "Untitled";
  // ──────────────────────────────────────────────────────────────────────────

  // ── SOAP per-field state ──────────────────────────────────────────────────
  const SOAP_FIELDS = ["soapSubjective", "soapObjective", "soapAssessment", "soapPlan"] as const;
  type SoapField = typeof SOAP_FIELDS[number];

  const [soapValues, setSoapValues] = useState<Record<SoapField, string>>({
    soapSubjective: "", soapObjective: "", soapAssessment: "", soapPlan: ""
  });
  const [soapInitialized, setSoapInitialized] = useState(false);

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

  // Auto-translate preview whenever it opens or the language changes
  useEffect(() => {
    if (!showRxPreview || previewLang === "en") {
      if (previewLang === "en") setPreviewTranslation(null);
      return;
    }
    const filledItems = drugItems.filter(i => i.drugName);
    const advice = adviceValue || consultation?.advice || undefined;
    translatePreviewMutation.mutate(
      { data: { language: previewLang, advice, items: filledItems.map(i => ({ dosage: i.dosage, frequency: i.frequency, duration: i.duration, instructions: i.instructions ?? undefined })) } },
      {
        onSuccess: (data) => { setPreviewTranslation(data); setPreviewDisplayMode("bilingual"); },
        onError: () => toast({ title: "Translation failed", variant: "destructive" }),
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRxPreview, previewLang]);

  const handleSoapChange = (field: SoapField, value: string) =>
    setSoapValues(prev => ({ ...prev, [field]: value }));

  const handleSoapBlur = (field: SoapField, value: string) => {
    handleBlur(field, value);
    trackFieldRecent(`clinicos_soap_${field}`, value);
  };
  // ─────────────────────────────────────────────────────────────────────────

  // ── Order Investigation state ──────────────────────────────────────────────
  const updateInvestigationMutation = useUpdateInvestigation();
  const [showInvestigationModal, setShowInvestigationModal] = useState(false);
  const [invType, setInvType] = useState("");
  const [invBodyPart, setInvBodyPart] = useState("");
  const [invNotes, setInvNotes] = useState("");
  // Inline notes editing per investigation card
  const [editingInvId, setEditingInvId] = useState<string | null>(null);
  const [editingInvNotes, setEditingInvNotes] = useState("");

  const { data: existingInvestigations } = useListInvestigations(
    { consultationId: id },
    { query: { enabled: !!id, queryKey: getListInvestigationsQueryKey({ consultationId: id }) } }
  );

  const handleSaveInvNotes = (invId: string) => {
    updateInvestigationMutation.mutate(
      { id: invId, data: { notes: editingInvNotes } },
      {
        onSuccess: () => {
          toast({ title: "Notes updated" });
          queryClient.invalidateQueries({ queryKey: getListInvestigationsQueryKey({ consultationId: id }) });
          setEditingInvId(null);
        },
        onError: () => toast({ title: "Failed to save notes", variant: "destructive" }),
      }
    );
  };

  const handleOrderInvestigation = () => {
    if (!consultation || !invType.trim()) return;
    createInvestigationMutation.mutate(
      {
        data: {
          patientId: consultation.patientId,
          patientName: consultation.patientName ?? undefined,
          consultationId: id,
          requestedById: consultation.doctorId,
          requestedByName: consultation.doctorName ?? undefined,
          type: invType,
          bodyPart: invBodyPart || undefined,
          notes: invNotes || undefined,
        },
      },
      {
        onSuccess: () => {
          trackInvestigationRecent({ type: invType, bodyPart: invBodyPart, notes: invNotes });
          toast({ title: "Investigation ordered" });
          queryClient.invalidateQueries({ queryKey: getListInvestigationsQueryKey({ consultationId: id }) });
          setShowInvestigationModal(false);
          setInvType("");
          setInvBodyPart("");
          setInvNotes("");
        },
        onError: () => toast({ title: "Failed to order investigation", variant: "destructive" }),
      }
    );
  };
  // ─────────────────────────────────────────────────────────────────────────

  const [showThankingLetter, setShowThankingLetter] = useState(false);
  const [thankingDoctorName, setThankingDoctorName] = useState("");
  const [thankingDoctorAddress, setThankingDoctorAddress] = useState("");
  const [thankingAdditionalNotes, setThankingAdditionalNotes] = useState("");

  const [showReferralLetter, setShowReferralLetter] = useState(false);
  const [referralToDoctor, setReferralToDoctor] = useState("");
  const [referralToSpecialty, setReferralToSpecialty] = useState("");
  const [referralToAddress, setReferralToAddress] = useState("");
  const [referralReason, setReferralReason] = useState("");

  // ── Invoice form & payment state ──────────────────────────────────────────
  type InvItem = { chargeTypeId: string; description: string; quantity: number; unitPrice: number; discount: number; total: number };
  const blankInvItem = (): InvItem => ({ chargeTypeId: "", description: "", quantity: 1, unitPrice: 0, discount: 0, total: 0 });
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [invItems, setInvItems] = useState<InvItem[]>([blankInvItem()]);
  const [invDiscount, setInvDiscount] = useState(0);
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [recordPayingId, setRecordPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState<"cash" | "card" | "upi" | "insurance">("cash");
  const [payRef, setPayRef] = useState("");

  const calcInvItemTotal = (qty: number, price: number, disc: number) =>
    +Math.max(0, qty * price - disc).toFixed(2);

  const invSubtotal = invItems.reduce((s, it) => s + it.total, 0);
  const invTotal = +Math.max(0, invSubtotal - invDiscount).toFixed(2);

  const updateInvItem = (idx: number, field: keyof InvItem, val: string | number) =>
    setInvItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const u = { ...it, [field]: val };
      if (field === "quantity" || field === "unitPrice" || field === "discount") {
        u.total = calcInvItemTotal(
          field === "quantity" ? +val : u.quantity,
          field === "unitPrice" ? +val : u.unitPrice,
          field === "discount" ? +val : u.discount,
        );
      }
      return u;
    }));

  const openNewInvoice = () => {
    setEditingInvoiceId(null);
    setInvItems([blankInvItem()]);
    setInvDiscount(0);
    setInvoiceNotes("");
    setShowInvoiceModal(true);
  };

  const openEditInvoice = (inv: {
    id: string;
    items: Array<{ chargeTypeId?: string | null; description: string; quantity: number; unitPrice: number; discount?: number | null; total: number }>;
    discount?: number | null;
    notes?: string | null;
  }) => {
    setEditingInvoiceId(inv.id);
    setInvItems(inv.items.map(it => ({
      chargeTypeId: it.chargeTypeId ?? "",
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discount: it.discount ?? 0,
      total: it.total,
    })));
    setInvDiscount(inv.discount ?? 0);
    setInvoiceNotes(inv.notes ?? "");
    setShowInvoiceModal(true);
  };

  const openRecordPayment = (inv: { id: string; balance?: number | null }) => {
    setRecordPayingId(inv.id);
    setPayAmount(inv.balance != null ? String(Math.max(0, inv.balance)) : "");
    setPayMode("cash");
    setPayRef("");
  };

  const handleSaveInvoice = (status: "draft" | "pending") => {
    const items = invItems.filter(it => it.description.trim());
    if (!items.length) { toast({ title: "Add at least one line item", variant: "destructive" }); return; }
    const body = {
      patientId,
      consultationId: id,
      doctorId: (consultation as unknown as Record<string, string | null | undefined>)?.doctorId ?? undefined,
      items: items.map(it => ({
        chargeTypeId: it.chargeTypeId || undefined,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discount: it.discount || undefined,
        tax: undefined as number | undefined,
        total: it.total,
      })),
      discount: invDiscount || undefined,
      notes: invoiceNotes || undefined,
    };
    if (editingInvoiceId) {
      updateInvoiceMutation.mutate(
        { id: editingInvoiceId, data: { ...body, status } },
        {
          onSuccess: () => {
            toast({ title: "Invoice updated" });
            queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey({ patientId: patientId || undefined, limit: 100 }) });
            setShowInvoiceModal(false);
          },
          onError: () => toast({ title: "Failed to update invoice", variant: "destructive" }),
        }
      );
    } else {
      createInvoiceMutation.mutate(
        { data: body },
        {
          onSuccess: () => {
            toast({ title: "Invoice created" });
            try {
              const stored = sessionStorage.getItem("clinicos_inv_created");
              const ids: string[] = stored ? JSON.parse(stored) : [];
              if (!ids.includes(patientId)) ids.push(patientId);
              sessionStorage.setItem("clinicos_inv_created", JSON.stringify(ids));
            } catch { /* ignore */ }
            queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey({ patientId: patientId || undefined, limit: 100 }) });
            setShowInvoiceModal(false);
          },
          onError: () => toast({ title: "Failed to create invoice", variant: "destructive" }),
        }
      );
    }
  };

  const handleRecordPayment = () => {
    if (!recordPayingId || !payAmount) return;
    recordPaymentMutation.mutate(
      { id: recordPayingId, data: { amount: +payAmount, paymentMode: payMode, transactionReference: payRef || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Payment recorded" });
          queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey({ patientId: patientId || undefined, limit: 100 }) });
          setRecordPayingId(null);
        },
        onError: () => toast({ title: "Failed to record payment", variant: "destructive" }),
      }
    );
  };

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
    diagnosis: diagnosisValue || consultation!.diagnosis || undefined,
    advice: adviceValue || consultation!.advice || undefined,
    followUpDate: consultation!.followUpDate ?? undefined,
    items: drugItems.filter(i => i.drugName),
  });

  const handleAddPrescription = (andPrint = false) => {
    if (!consultation) return;
    trackRxRecent();
    const payload = buildPrescriptionPayload();
    const onError = (err: unknown) => {
      const status = (err as { status?: number })?.status;
      if (status === 401) {
        toast({
          title: "Session expired",
          description: "Your session expired. Please log in again — your prescription data is preserved on this page.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to save prescription",
          description: (err as Error)?.message ?? "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
      }
    };

    if (editRxId) {
      updatePrescriptionMutation.mutate(
        { id: editRxId, data: { diagnosis: payload.diagnosis, advice: payload.advice, followUpDate: payload.followUpDate, items: payload.items } },
        {
          onSuccess: () => {
            toast({ title: "Prescription updated" });
            queryClient.invalidateQueries({ queryKey: getListPrescriptionsQueryKey({ consultationId: id }) });
            setShowPrescriptionModal(false);
            setEditRxId(null);
            setDrugItems([{ drugName: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
            if (andPrint) navigate(`/prescriptions/${editRxId}?print=1`);
          },
          onError,
        }
      );
    } else {
      createPrescriptionMutation.mutate({ data: payload }, {
        onSuccess: (rx) => {
          toast({ title: "Prescription created" });
          queryClient.invalidateQueries({ queryKey: getListPrescriptionsQueryKey({ consultationId: id }) });
          setShowPrescriptionModal(false);
          setDrugItems([{ drugName: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
          if (andPrint) navigate(`/prescriptions/${rx.id}?print=1`);
        },
        onError,
      });
    }
  };

  const handleAddSelectedDrugs = () => {
    // Iterate the Set (which preserves insertion/click order) rather than filtering
    // the drugs array (which is sorted by frequency and ignores selection order).
    const toAdd = [...selectedDrugIds]
      .map(id => drugs.find(d => d.id === id))
      .filter((d): d is NonNullable<typeof d> => !!d);
    if (!toAdd.length) return;
    trackDrugFreq(toAdd.map(d => d.id));
    const newRows: DrugItem[] = toAdd.map(d => ({
      drugId: d.id,
      drugName: d.name,
      genericName: d.genericName ?? null,
      dosage: d.defaultDosage ?? "",
      frequency: d.defaultFrequency ?? "",
      duration: d.defaultDuration ?? "",
      instructions: d.defaultInstructions ?? "",
    }));
    setDrugItems(prev => {
      const nonEmpty = prev.filter(i => i.drugName.trim());
      return [...nonEmpty, ...newRows];
    });
    setSelectedDrugIds(new Set());
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
            <h1 className="text-xl font-bold flex items-baseline gap-2">
              {consultation.patientName}
              {patient && (patient.age || patient.gender) && (
                <span className="text-sm font-normal text-muted-foreground">
                  {[patient.age, patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : ""].filter(Boolean).join(" · ")}
                </span>
              )}
            </h1>
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

      <div className="space-y-3">
        {/* Quick Actions bar */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm" variant="outline" className="relative"
            onClick={() => setShowInvestigationModal(true)}
            data-testid="btn-order-investigation"
          >
            <ScanLine className="mr-1.5 h-3 w-3" /> Order Investigation
            {(existingInvestigations?.data?.length ?? 0) > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({existingInvestigations!.data!.length})
              </span>
            )}
          </Button>
          <Link href={`/certificates?patientId=${consultation?.patientId ?? ""}&doctorId=${consultation?.doctorId ?? ""}`}>
            <Button size="sm" variant="outline">
              <FileText className="mr-1.5 h-3 w-3" /> Generate Certificate
            </Button>
          </Link>
          <Button size="sm" variant="outline" onClick={() => {
            setThankingDoctorName(clinicalValues["referringDoctorName"] ?? "");
            setShowThankingLetter(true);
          }}>
            <Mail className="mr-1.5 h-3 w-3" /> Thanking Letter
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowReferralLetter(true)}>
            <Send className="mr-1.5 h-3 w-3" /> Referral Letter
          </Button>
        </div>

        <div>
          <Tabs defaultValue="soap">
            <TabsList className="w-full h-auto flex-wrap gap-px p-1">
              {/* Row 1 */}
              <TabsTrigger value="soap" className="flex-[1_1_25%]">SOAP Notes</TabsTrigger>
              <TabsTrigger value="medhistory" className="flex-[1_1_25%]">Medical History</TabsTrigger>
              <TabsTrigger value="clinical" className="flex-[1_1_25%]">Clinical Notes</TabsTrigger>
              <TabsTrigger value="investigation" className="flex-[1_1_25%]">Investigations</TabsTrigger>
              {/* Row 2 */}
              <TabsTrigger value="diagnosis" className="flex-[1_1_25%]">Diagnosis &amp; Advice</TabsTrigger>
              <TabsTrigger value="prescriptions" className="flex-[1_1_25%] relative">
                Prescriptions
                {prescriptions.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-semibold px-1.5 min-w-[18px] h-[18px]">
                    {prescriptions.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="emrhistory" className="flex-[1_1_25%] relative">
                EMR History
                {(() => {
                  const cnt = (patientHistory?.consultations ?? []).filter(c => c.id !== id).length;
                  return cnt > 0 ? (
                    <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-[10px] font-semibold px-1.5 min-w-[18px] h-[18px]">
                      {cnt}
                    </span>
                  ) : null;
                })()}
              </TabsTrigger>
              <TabsTrigger value="invoices" className="flex-[1_1_25%] relative">
                Invoices
                {(() => {
                  const cnt = (invoicesData?.data ?? []).length;
                  return cnt > 0 ? (
                    <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-[10px] font-semibold px-1.5 min-w-[18px] h-[18px]">
                      {cnt}
                    </span>
                  ) : null;
                })()}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="soap" className="mt-4 space-y-4">
              {/* Referring Doctor — sits above SOAP fields */}
              <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 items-center">
                <Label className="text-xs">Referring Doctor</Label>
                <FieldFavPanel
                  lsKey="clinicos_clin_referringDoctorName"
                  currentValue={clinicalValues["referringDoctorName"]}
                  onApply={v => { setClinicalValues(prev => ({ ...prev, referringDoctorName: v })); handleBlur("referringDoctorName", v); }}
                />
                <Input
                  className="col-span-full"
                  value={clinicalValues["referringDoctorName"]}
                  onChange={e => setClinicalValues(prev => ({ ...prev, referringDoctorName: e.target.value }))}
                  onBlur={e => { handleBlur("referringDoctorName", e.target.value); trackFieldRecent("clinicos_clin_referringDoctorName", e.target.value); }}
                  placeholder="Name of referring doctor (if any)"
                />
              </div>

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
                return (
                  <div key={field} className="space-y-1">
                    <div className="grid grid-cols-[1fr_auto] gap-x-2 items-center">
                      <div>
                        <span className="text-xs font-semibold">{labels[field]}</span>
                        <span className="text-xs text-muted-foreground ml-1">— {sublabels[field]}</span>
                      </div>
                      <FieldFavPanel
                        lsKey={`clinicos_soap_${field}`}
                        currentValue={soapValues[field]}
                        onApply={v => { setSoapValues(prev => ({ ...prev, [field]: v })); handleBlur(field, v); }}
                      />
                    </div>
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

            <TabsContent value="investigation" className="mt-4 space-y-4">
              {/* Hidden file input for clinical attachments */}
              <input
                ref={clinicalAttachRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={handleClinicalFileChange}
              />

              {/* Free-text notes */}
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
                  rows={6}
                  placeholder="Blood tests, imaging, referrals..."
                />
              </div>

              {/* Clinical Attachments */}
              {(() => {
                const atts = parseAttachments(consultation?.clinicalAttachments);
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs flex items-center gap-1.5">
                        <Paperclip className="h-3.5 w-3.5" />
                        Clinical Attachments
                        {atts.length > 0 && (
                          <span className="ml-1 rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-semibold">
                            {atts.length}
                          </span>
                        )}
                      </Label>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => clinicalAttachRef.current?.click()}
                        disabled={clinicalAttachLoading}
                      >
                        {clinicalAttachLoading ? (
                          <span className="animate-pulse">Uploading…</span>
                        ) : (
                          <>
                            <Paperclip className="h-3 w-3" />
                            Add Files
                          </>
                        )}
                      </Button>
                    </div>

                    {atts.length === 0 ? (
                      <button
                        onClick={() => clinicalAttachRef.current?.click()}
                        disabled={clinicalAttachLoading}
                        className="w-full rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition py-6 flex flex-col items-center gap-1.5 text-muted-foreground text-sm"
                      >
                        <Paperclip className="h-5 w-5 opacity-50" />
                        <span>Click to attach images or PDFs</span>
                        <span className="text-xs opacity-60">Photos, ECGs, referral letters, consent forms… up to 8 MB each</span>
                      </button>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {atts.map((att, idx) => (
                          isPdfData(att.data) ? (
                            <div key={idx} className="flex items-center gap-1 rounded border border-border bg-red-50 dark:bg-red-950/30 pl-2 pr-1 py-1">
                              <button
                                onClick={() => openInNewTab(att.data)}
                                className="flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400 hover:underline"
                              >
                                <FileText className="h-3.5 w-3.5 shrink-0" />
                                {att.name.length > 22 ? att.name.slice(0, 20) + "…" : att.name}
                              </button>
                              <button
                                onClick={() => handleRemoveClinicalAttachment(idx)}
                                className="ml-1 text-muted-foreground hover:text-destructive transition"
                                title="Remove"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <div key={idx} className="relative group">
                              <button
                                onClick={() => setInvImagePreview({ open: true, src: att.data, label: att.name })}
                                className="block rounded overflow-hidden border border-border hover:ring-2 hover:ring-primary transition"
                                title={att.name}
                              >
                                <img src={att.data} alt={att.name} className="h-16 w-16 object-cover" />
                              </button>
                              <button
                                onClick={() => handleRemoveClinicalAttachment(idx)}
                                className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center h-4 w-4 rounded-full bg-destructive text-white shadow"
                                title="Remove"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Radiology job results */}
              {(() => {
                const jobs = existingInvestigations?.data ?? [];
                if (jobs.length === 0) return null;
                return (
                  <div className="space-y-2">
                    <Label className="text-xs flex items-center gap-1.5">
                      <ScanLine className="h-3.5 w-3.5" /> Radiology Jobs ({jobs.length})
                    </Label>
                    <div className="space-y-2">
                      {jobs.map(inv => {
                        const atts = parseAttachments(inv.imageAttachment);
                        return (
                          <div
                            key={inv.id}
                            className="rounded-lg border border-border bg-card p-3 space-y-2"
                          >
                            {/* Header row */}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium text-sm">
                                  {inv.type}
                                  {inv.bodyPart ? <span className="text-muted-foreground font-normal"> — {inv.bodyPart}</span> : ""}
                                </p>
                              </div>
                              <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${INV_STATUS_COLORS[inv.status]}`}>
                                {INV_STATUS_LABELS[inv.status]}
                              </span>
                            </div>

                            {/* Consultant notes — inline edit */}
                            {editingInvId === inv.id ? (
                              <div className="space-y-1.5">
                                <p className="text-xs font-medium text-muted-foreground">Clinical Notes</p>
                                <Textarea
                                  autoFocus
                                  className="text-sm"
                                  rows={3}
                                  value={editingInvNotes}
                                  onChange={e => setEditingInvNotes(e.target.value)}
                                  placeholder="Add clinical context, suspicion, urgency..."
                                />
                                <div className="flex gap-2 justify-end">
                                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingInvId(null)}>Cancel</Button>
                                  <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveInvNotes(inv.id)} disabled={updateInvestigationMutation.isPending}>
                                    Save Notes
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2 min-h-[1.25rem]">
                                <p className="text-xs text-muted-foreground flex-1 whitespace-pre-wrap">
                                  {inv.notes || <span className="italic">No clinical notes</span>}
                                </p>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-xs shrink-0 text-muted-foreground hover:text-foreground"
                                  onClick={() => { setEditingInvId(inv.id); setEditingInvNotes(inv.notes ?? ""); }}
                                >
                                  {inv.notes ? "Edit" : "+ Add"} Notes
                                </Button>
                              </div>
                            )}

                            {/* Completed results */}
                            {inv.status === "completed" && (
                              <div className="space-y-2 pt-1 border-t border-border">
                                {inv.resultNotes && (
                                  <div className="space-y-0.5">
                                    <p className="text-xs font-medium text-muted-foreground">Result Notes</p>
                                    <p className="text-sm whitespace-pre-wrap">{inv.resultNotes}</p>
                                  </div>
                                )}
                                {atts.length > 0 && (
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                      <Paperclip className="h-3 w-3" />
                                      {atts.length} attachment{atts.length > 1 ? "s" : ""}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {atts.map((att, idx) => (
                                        isPdfData(att.data) ? (
                                          <button
                                            key={idx}
                                            onClick={() => openInNewTab(att.data)}
                                            className="flex items-center gap-1.5 rounded border border-border bg-red-50 dark:bg-red-950/30 px-2.5 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 hover:ring-2 hover:ring-red-400 transition"
                                          >
                                            <FileText className="h-3.5 w-3.5 shrink-0" />
                                            {att.name.length > 20 ? att.name.slice(0, 18) + "…" : att.name}
                                          </button>
                                        ) : (
                                          <button
                                            key={idx}
                                            onClick={() => setInvImagePreview({ open: true, src: att.data, label: att.name })}
                                            className="block rounded overflow-hidden border border-border hover:ring-2 hover:ring-primary transition"
                                            title={att.name}
                                          >
                                            <img src={att.data} alt={att.name} className="h-16 w-16 object-cover" />
                                          </button>
                                        )
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {!inv.resultNotes && atts.length === 0 && (
                                  <p className="text-xs text-muted-foreground italic">No result notes or attachments added by radiographer.</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </TabsContent>

            {/* ── Diagnosis & Advice tab ──────────────────────────────────── */}
            <TabsContent value="diagnosis" className="mt-4">
              <div className="rounded-lg border border-border bg-card p-4 space-y-3 max-w-2xl">
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
                    rows={4}
                    placeholder="Advice and instructions..."
                  />
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 items-center">
                  <Label className="text-xs">Reference To</Label>
                  <FieldFavPanel
                    lsKey="clinicos_reference_to"
                    currentValue={referenceToValue}
                    onApply={v => { setReferenceToValue(v); handleBlur("referenceTo", v); }}
                  />
                  <Input
                    className="col-span-full"
                    value={referenceToValue}
                    onChange={e => setReferenceToValue(e.target.value)}
                    onBlur={e => { handleBlur("referenceTo", e.target.value); trackFieldRecent("clinicos_reference_to_recent", e.target.value); }}
                    placeholder="Dr. Name / Hospital / Speciality"
                  />
                </div>
              </div>
            </TabsContent>

            {/* ── Prescriptions tab ───────────────────────────────────────── */}
            <TabsContent value="prescriptions" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Prescriptions for this visit</p>
                <Button size="sm" variant="outline" onClick={() => setShowPrescriptionModal(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Add Prescription
                </Button>
              </div>
              {prescriptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No prescriptions yet for this visit.</p>
              ) : (
                <div className="space-y-2">
                  {prescriptions.map(p => (
                    <div key={p.id} className="rounded-lg border border-border p-3 flex items-center justify-between gap-2">
                      <Link href={`/prescriptions/${p.id}`} className="flex-1 min-w-0">
                        <div className="hover:opacity-70 transition-opacity">
                          <p className="text-sm font-medium">{p.items.length} medication{p.items.length !== 1 ? "s" : ""}</p>
                          <p className="text-xs text-muted-foreground">{p.visitDate}</p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm" variant="outline"
                          className="h-7 text-xs"
                          onClick={() => {
                            setDrugItems(
                              (p.items as DrugItem[]).length > 0
                                ? (p.items as DrugItem[]).map(i => ({ ...i }))
                                : [{ drugName: "", dosage: "", frequency: "", duration: "", instructions: "" }]
                            );
                            setEditRxId(p.id);
                            setShowRxPreview(false);
                            setShowPrescriptionModal(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Link href={`/prescriptions/${p.id}`}>
                          <Button size="icon" variant="ghost" className="h-7 w-7">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── EMR History tab ─────────────────────────────────────────── */}
            <TabsContent value="emrhistory" className="mt-4">
              {(() => {
                const pastVisits = (patientHistory?.consultations ?? [])
                  .filter(c => c.id !== id)
                  .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());

                if (!patientHistory) {
                  return (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
                    </div>
                  );
                }

                if (pastVisits.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                      <FileText className="h-10 w-10 mb-3 opacity-30" />
                      <p className="text-sm font-medium">No previous visits</p>
                      <p className="text-xs mt-1">This is the patient's first consultation on record.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {pastVisits.map(visit => {
                      const isOpen = expandedVisit === visit.id;
                      const rxForVisit = (patientHistory.prescriptions ?? []).filter(
                        p => p.consultationId === visit.id
                      );
                      const hasDiagnosis = !!(visit.diagnosis || visit.icd10Code);

                      return (
                        <div key={visit.id} className="rounded-lg border border-border bg-card overflow-hidden">
                          {/* Visit header — always visible */}
                          <button
                            type="button"
                            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                            onClick={() => setExpandedVisit(isOpen ? null : visit.id)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold">
                                  {fmtDate(visit.visitDate)}
                                </span>
                                <Badge
                                  variant={visit.status === "completed" ? "default" : "secondary"}
                                  className="text-[10px] h-4 px-1.5"
                                >
                                  {visit.status}
                                </Badge>
                                {rxForVisit.length > 0 && (
                                  <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                                    💊 {rxForVisit.length} Rx
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {visit.doctorName ? `Dr. ${visit.doctorName}` : "—"}
                                {visit.chiefComplaint ? ` · ${visit.chiefComplaint}` : ""}
                              </p>
                              {hasDiagnosis && (
                                <p className="text-xs font-medium mt-0.5 truncate">
                                  Dx: {visit.diagnosis}{visit.icd10Code ? ` (${visit.icd10Code})` : ""}
                                </p>
                              )}
                            </div>
                            <span className="text-muted-foreground shrink-0 mt-0.5 text-sm select-none">
                              {isOpen ? "▲" : "▼"}
                            </span>
                          </button>

                          {/* Expanded detail */}
                          {isOpen && (
                            <div className="border-t border-border px-4 py-3 space-y-4 text-xs">
                              {/* SOAP notes */}
                              {(visit.soapSubjective || visit.soapObjective || visit.soapAssessment || visit.soapPlan) && (
                                <div className="space-y-2">
                                  <p className="font-semibold text-[11px] uppercase tracking-wide text-muted-foreground">SOAP Notes</p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {[
                                      { label: "S — Subjective", val: visit.soapSubjective },
                                      { label: "O — Objective", val: visit.soapObjective },
                                      { label: "A — Assessment", val: visit.soapAssessment },
                                      { label: "P — Plan", val: visit.soapPlan },
                                    ].filter(r => r.val).map(r => (
                                      <div key={r.label} className="rounded border border-border bg-muted/30 p-2">
                                        <p className="font-semibold text-[10px] text-muted-foreground mb-0.5">{r.label}</p>
                                        <p className="whitespace-pre-wrap">{r.val}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Clinical / HPI */}
                              {(visit.clinicalNotes || visit.historyOfPresentIllness) && (
                                <div className="space-y-2">
                                  <p className="font-semibold text-[11px] uppercase tracking-wide text-muted-foreground">Clinical Notes</p>
                                  {visit.historyOfPresentIllness && (
                                    <div className="rounded border border-border bg-muted/30 p-2">
                                      <p className="font-semibold text-[10px] text-muted-foreground mb-0.5">History of Present Illness</p>
                                      <p className="whitespace-pre-wrap">{visit.historyOfPresentIllness}</p>
                                    </div>
                                  )}
                                  {visit.clinicalNotes && (
                                    <div className="rounded border border-border bg-muted/30 p-2">
                                      <p className="font-semibold text-[10px] text-muted-foreground mb-0.5">Clinical Notes</p>
                                      <p className="whitespace-pre-wrap">{visit.clinicalNotes}</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Investigations */}
                              {visit.investigationOrders && (
                                <div>
                                  <p className="font-semibold text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Investigations</p>
                                  <div className="rounded border border-border bg-muted/30 p-2 whitespace-pre-wrap">{visit.investigationOrders}</div>
                                </div>
                              )}

                              {/* Advice / Follow-up */}
                              {(visit.advice || visit.followUpDate) && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {visit.advice && (
                                    <div className="rounded border border-border bg-muted/30 p-2">
                                      <p className="font-semibold text-[10px] text-muted-foreground mb-0.5">Advice</p>
                                      <p className="whitespace-pre-wrap">{visit.advice}</p>
                                    </div>
                                  )}
                                  {visit.followUpDate && (
                                    <div className="rounded border border-border bg-muted/30 p-2">
                                      <p className="font-semibold text-[10px] text-muted-foreground mb-0.5">Follow-up</p>
                                      <p>{fmtDate(visit.followUpDate)}</p>
                                      {visit.followUpNotes && <p className="mt-0.5 text-muted-foreground">{visit.followUpNotes}</p>}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Prescriptions for this visit */}
                              {rxForVisit.length > 0 && (
                                <div className="space-y-2">
                                  <p className="font-semibold text-[11px] uppercase tracking-wide text-muted-foreground">Prescriptions</p>
                                  {rxForVisit.map(rx => (
                                    <div key={rx.id} className="rounded border border-border bg-muted/30 p-2 space-y-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[10px] text-muted-foreground">
                                          {fmtDate(rx.visitDate)}
                                        </span>
                                        <Link
                                          href={`/prescriptions/${rx.id}`}
                                          className="text-[10px] text-blue-600 hover:underline"
                                        >
                                          View Rx →
                                        </Link>
                                      </div>
                                      <table className="w-full text-[11px]">
                                        <thead>
                                          <tr className="text-muted-foreground">
                                            <th className="text-left font-medium py-0.5 pr-2">Drug</th>
                                            <th className="text-left font-medium py-0.5 pr-2">Dose</th>
                                            <th className="text-left font-medium py-0.5 pr-2">Freq</th>
                                            <th className="text-left font-medium py-0.5">Duration</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(rx.items as DrugItem[]).map((item, idx) => (
                                            <tr key={idx} className="border-t border-border/50">
                                              <td className="py-0.5 pr-2 font-medium">{item.drugName}</td>
                                              <td className="py-0.5 pr-2 text-muted-foreground">{item.dosage}</td>
                                              <td className="py-0.5 pr-2 text-muted-foreground">{item.frequency}</td>
                                              <td className="py-0.5 text-muted-foreground">{item.duration}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Vitals snapshot */}
                              {visit.vitals && Object.keys(visit.vitals as object).length > 0 && (
                                <div>
                                  <p className="font-semibold text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Vitals</p>
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(visit.vitals as Record<string, string | number>)
                                      .filter(([, v]) => v !== null && v !== undefined && v !== "")
                                      .map(([k, v]) => (
                                        <span key={k} className="rounded border border-border bg-muted/30 px-2 py-0.5 text-[11px]">
                                          <span className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1").trim()}: </span>
                                          {String(v)}
                                        </span>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </TabsContent>

            {/* ── Invoices tab ─────────────────────────────────────────────── */}
            <TabsContent value="invoices" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Patient Invoices</p>
                <Button size="sm" onClick={openNewInvoice}>
                  <Plus className="h-3 w-3 mr-1" /> New Invoice
                </Button>
              </div>
              {(() => {
                const allInvoices = (invoicesData?.data ?? [])
                  .slice()
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                if (!invoicesData) {
                  return (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                    </div>
                  );
                }

                if (allInvoices.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                      <Receipt className="h-10 w-10 mb-3 opacity-30" />
                      <p className="text-sm font-medium">No invoices yet</p>
                      <p className="text-xs mt-1">Click "New Invoice" to create the first invoice for this visit.</p>
                    </div>
                  );
                }

                const statusColor: Record<string, string> = {
                  paid:      "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
                  partial:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
                  pending:   "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
                  draft:     "bg-muted text-muted-foreground",
                  cancelled: "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400",
                  refunded:  "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
                };

                return (
                  <div className="rounded-lg border border-border bg-card overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 border-b border-border">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Invoice #</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Date</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Total</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Paid</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Balance</th>
                          <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allInvoices.map(inv => {
                          const isThisConsultation = inv.consultationId === id;
                          const canEdit = inv.status === "draft" || inv.status === "pending";
                          const hasBalance = (inv.balance ?? 0) > 0 && inv.status !== "cancelled" && inv.status !== "paid" && inv.status !== "refunded";
                          return (
                            <tr
                              key={inv.id}
                              className={`border-t border-border ${isThisConsultation ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
                            >
                              <td className="px-4 py-2.5 font-medium font-mono text-xs">
                                {inv.invoiceNumber}
                                {isThisConsultation && (
                                  <span className="ml-1.5 text-[10px] text-blue-600 dark:text-blue-400 font-sans">(this visit)</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                                {fmtDate(inv.createdAt)}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${statusColor[inv.status] ?? "bg-muted text-muted-foreground"}`}>
                                  {inv.status}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right text-xs font-medium">₹{inv.total.toFixed(2)}</td>
                              <td className="px-4 py-2.5 text-right text-xs text-green-700 dark:text-green-400">₹{(inv.amountPaid ?? 0).toFixed(2)}</td>
                              <td className="px-4 py-2.5 text-right text-xs text-orange-600 dark:text-orange-400">
                                {(inv.balance ?? 0) > 0 ? `₹${(inv.balance ?? 0).toFixed(2)}` : "—"}
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center justify-center gap-2.5">
                                  {canEdit && (
                                    <button
                                      onClick={() => openEditInvoice(inv)}
                                      className="text-[11px] text-blue-600 hover:underline whitespace-nowrap"
                                    >Edit</button>
                                  )}
                                  {hasBalance && (
                                    <button
                                      onClick={() => openRecordPayment(inv)}
                                      className="text-[11px] text-green-700 dark:text-green-400 hover:underline whitespace-nowrap font-medium"
                                    >Pay</button>
                                  )}
                                  <Link
                                    href={`/billing/${inv.id}`}
                                    className="text-[11px] text-blue-600 hover:underline whitespace-nowrap"
                                  >View →</Link>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {allInvoices.length > 1 && (
                        <tfoot className="border-t border-border bg-muted/30">
                          <tr>
                            <td colSpan={3} className="px-4 py-2 text-xs font-medium text-muted-foreground">
                              {allInvoices.length} invoices
                            </td>
                            <td className="px-4 py-2 text-right text-xs font-semibold">
                              ₹{allInvoices.reduce((s, i) => s + i.total, 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-right text-xs font-semibold text-green-700 dark:text-green-400">
                              ₹{allInvoices.reduce((s, i) => s + (i.amountPaid ?? 0), 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-right text-xs font-semibold text-orange-600 dark:text-orange-400">
                              {allInvoices.reduce((s, i) => s + (i.balance ?? 0), 0) > 0
                                ? `₹${allInvoices.reduce((s, i) => s + (i.balance ?? 0), 0).toFixed(2)}`
                                : "—"}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                );
              })()}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Investigation attachment image preview */}
      <Dialog open={invImagePreview.open} onOpenChange={open => setInvImagePreview(p => ({ ...p, open }))}>
        <DialogContent className="max-w-3xl p-2">
          <DialogHeader className="px-3 pt-2 pb-0">
            <DialogTitle className="flex items-center gap-2 text-sm font-medium">
              <ImageIcon className="h-4 w-4" />
              {invImagePreview.label}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 rounded-lg overflow-hidden bg-black/10 dark:bg-black/40">
            <img
              src={invImagePreview.src}
              alt={invImagePreview.label}
              className="w-full max-h-[75vh] object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Order Investigation Dialog */}
      <Dialog open={showInvestigationModal} onOpenChange={setShowInvestigationModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-primary" />
              Order Investigation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <InvestigationFavPanel
              type={invType}
              bodyPart={invBodyPart}
              notes={invNotes}
              onApply={({ type, bodyPart, notes }) => {
                setInvType(type);
                setInvBodyPart(bodyPart);
                setInvNotes(notes);
              }}
            />
            <div className="space-y-1.5">
              <Label>Investigation Type <span className="text-destructive">*</span></Label>
              <Select value={invType} onValueChange={setInvType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {["X-Ray", "CT Scan", "MRI", "Ultrasound", "ECG", "Echocardiography", "Mammography", "Bone Density Scan", "Blood Test", "Biopsy", "Other"].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Body Part / Region <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                value={invBodyPart}
                onChange={e => setInvBodyPart(e.target.value)}
                placeholder="e.g. Chest, Abdomen, Left knee..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Clinical Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                value={invNotes}
                onChange={e => setInvNotes(e.target.value)}
                placeholder="Reason for investigation, clinical suspicion..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvestigationModal(false)}>Cancel</Button>
            <Button
              onClick={handleOrderInvestigation}
              disabled={!invType.trim() || createInvestigationMutation.isPending}
            >
              <ScanLine className="mr-2 h-4 w-4" />
              Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPrescriptionModal} onOpenChange={v => { setShowPrescriptionModal(v); if (!v) { setShowRxPreview(false); setEditRxId(null); setPreviewTranslation(null); setPreviewLang("mr"); } }}>
        <DialogContent className="max-w-6xl w-full max-h-[95vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle>{showRxPreview ? "Preview Prescription" : editRxId ? "Edit Prescription" : "Add Prescription"}</DialogTitle>
              {!showRxPreview && (
                <Button
                  type="button" size="sm"
                  variant={showRxTemplateDialog ? "secondary" : "outline"}
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => { setShowRxTemplateDialog(true); setRxFavName(""); setSelectedTemplateIds(new Set()); }}
                >
                  <BookMarked className="h-3 w-3" />
                  {(() => { const f = getRxFavs().length; const r = getRxRecent().length; return f > 0 || r > 0 ? `${f} fav · ${r} recent` : "Templates"; })()}
                </Button>
              )}
            </div>
          </DialogHeader>

          {/* ── PREVIEW MODE ── */}
          {showRxPreview ? (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Translation controls */}
              <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-border">
                <div className="flex items-center gap-1.5 border border-border rounded-md px-2 py-1">
                  <Languages className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <Select value={previewLang} onValueChange={v => { setPreviewLang(v); setPreviewTranslation(null); }}>
                    <SelectTrigger className="border-0 h-7 text-xs p-0 focus:ring-0 w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RX_PREVIEW_LANGUAGES.map(l => (
                        <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {translatePreviewMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>
                {previewTranslation && (
                  <div className="flex items-center gap-1 border border-border rounded-md p-0.5">
                    {(["english", "bilingual", "translated"] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setPreviewDisplayMode(mode)}
                        className={`text-xs px-2 py-0.5 rounded transition-colors font-medium ${previewDisplayMode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        {mode === "english" ? "EN" : mode === "translated" ? (previewTranslation.languageName ?? "Translated") : "Bilingual"}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Letterhead */}
              <div className="border-b-2 border-primary pb-3 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-primary">{clinicSettings?.clinicName ?? "Hospital"}</h2>
                  {clinicSettings?.address && <p className="text-xs text-muted-foreground">{clinicSettings.address}</p>}
                  {clinicSettings?.phone && <p className="text-xs text-muted-foreground">Tel: {clinicSettings.phone}</p>}
                  {clinicSettings?.email && <p className="text-xs text-muted-foreground">{clinicSettings.email}</p>}
                  {clinicSettings?.website && <p className="text-xs text-muted-foreground">{clinicSettings.website}</p>}
                  {clinicSettings?.registrationNumber && <p className="text-xs text-muted-foreground">Reg: {clinicSettings.registrationNumber}</p>}
                </div>
                <div className="flex-1 text-right">
                  <p className="text-sm font-semibold">Dr. {consultation?.doctorName ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(new Date())}</p>
                </div>
              </div>

              {/* Patient block */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 p-2.5 bg-muted/30 rounded text-sm divide-x divide-border">
                <div className="pr-4">
                  <p className="text-xs text-muted-foreground">Patient</p>
                  <p className="font-medium">{consultation?.patientName ?? "—"}</p>
                </div>
                {patient?.age && (
                  <div className="pl-4 pr-4">
                    <p className="text-xs text-muted-foreground">Age</p>
                    <p className="font-medium">{patient.age}</p>
                  </div>
                )}
                {(patient as unknown as Record<string, string> | undefined)?.gender && (
                  <div className="pl-4 pr-4">
                    <p className="text-xs text-muted-foreground">Sex</p>
                    <p className="font-medium capitalize">{(patient as unknown as Record<string, string>).gender}</p>
                  </div>
                )}
              </div>

              {/* Allergies */}
              {(patient as unknown as Record<string, string> | undefined)?.allergies && (
                <div className="flex items-start gap-2 px-2.5 py-1.5 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs">
                  <span className="font-bold uppercase tracking-wide shrink-0">⚠ Allergies:</span>
                  <span>{(patient as unknown as Record<string, string>).allergies}</span>
                </div>
              )}

              {/* Chief Complaint */}
              {(clinicalValues["chiefComplaint"] || consultation?.chiefComplaint) && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Chief Complaint</p>
                  <p className="text-sm whitespace-pre-wrap">{clinicalValues["chiefComplaint"] || consultation?.chiefComplaint}</p>
                </div>
              )}

              {/* SOAP Notes */}
              {(soapValues.soapSubjective || soapValues.soapObjective || soapValues.soapAssessment || soapValues.soapPlan) && (
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">SOAP Notes</p>
                  {soapValues.soapSubjective && <p className="text-sm whitespace-pre-wrap"><span className="font-medium">S: </span>{soapValues.soapSubjective}</p>}
                  {soapValues.soapObjective  && <p className="text-sm whitespace-pre-wrap"><span className="font-medium">O: </span>{soapValues.soapObjective}</p>}
                  {soapValues.soapAssessment && <p className="text-sm whitespace-pre-wrap"><span className="font-medium">A: </span>{soapValues.soapAssessment}</p>}
                  {soapValues.soapPlan       && <p className="text-sm whitespace-pre-wrap"><span className="font-medium">P: </span>{soapValues.soapPlan}</p>}
                </div>
              )}

              {/* Investigations */}
              {(investigationValue || consultation?.investigationOrders) && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Investigations</p>
                  <p className="text-sm whitespace-pre-wrap">{investigationValue || consultation?.investigationOrders}</p>
                </div>
              )}

              {/* Diagnosis */}
              {(diagnosisValue || consultation?.diagnosis) && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Diagnosis</p>
                  <p className="text-sm whitespace-pre-wrap">{diagnosisValue || consultation?.diagnosis}</p>
                </div>
              )}

              {/* Rx drugs */}
              {(() => {
                const filledItems = drugItems.filter(i => i.drugName);
                const showEn = previewDisplayMode !== "translated" || !previewTranslation;
                const showTr = previewDisplayMode !== "english" && !!previewTranslation;
                const isBilingual = previewDisplayMode === "bilingual" && !!previewTranslation;
                return filledItems.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Rx — Medications</p>
                    <table className="w-full text-xs border border-border rounded overflow-hidden">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left py-1.5 px-2">#</th>
                          <th className="text-left py-1.5 px-2">Drug</th>
                          <th className="text-left py-1.5 px-2">Dosage</th>
                          <th className="text-left py-1.5 px-2">Frequency</th>
                          <th className="text-left py-1.5 px-2">Duration</th>
                          <th className="text-left py-1.5 px-2">Instructions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filledItems.map((item, idx) => {
                          const tr = previewTranslation?.items?.[idx];
                          return (
                            <tr key={idx} className="border-t border-border">
                              <td className="py-1.5 px-2 text-muted-foreground">{idx + 1}</td>
                              <td className="py-1.5 px-2 font-medium">{item.drugName}</td>
                              <td className="py-1.5 px-2">
                                {showEn && <span>{item.dosage || "—"}</span>}
                                {isBilingual && tr?.dosage && tr.dosage !== item.dosage && <span className="block text-blue-700 dark:text-blue-400" style={{ fontFamily: "'Noto Sans', sans-serif" }}>{tr.dosage}</span>}
                                {!showEn && showTr && <span style={{ fontFamily: "'Noto Sans', sans-serif" }}>{tr?.dosage || item.dosage || "—"}</span>}
                              </td>
                              <td className="py-1.5 px-2">
                                {showEn && <span>{item.frequency || "—"}</span>}
                                {isBilingual && tr?.frequency && tr.frequency !== item.frequency && <span className="block text-blue-700 dark:text-blue-400" style={{ fontFamily: "'Noto Sans', sans-serif" }}>{tr.frequency}</span>}
                                {!showEn && showTr && <span style={{ fontFamily: "'Noto Sans', sans-serif" }}>{tr?.frequency || item.frequency || "—"}</span>}
                              </td>
                              <td className="py-1.5 px-2">
                                {showEn && <span>{item.duration || "—"}</span>}
                                {isBilingual && tr?.duration && tr.duration !== item.duration && <span className="block text-blue-700 dark:text-blue-400" style={{ fontFamily: "'Noto Sans', sans-serif" }}>{tr.duration}</span>}
                                {!showEn && showTr && <span style={{ fontFamily: "'Noto Sans', sans-serif" }}>{tr?.duration || item.duration || "—"}</span>}
                              </td>
                              <td className="py-1.5 px-2 text-muted-foreground">
                                {showEn && <span>{item.instructions || "—"}</span>}
                                {isBilingual && tr?.instructions && tr.instructions !== item.instructions && <span className="block text-blue-700 dark:text-blue-400" style={{ fontFamily: "'Noto Sans', sans-serif" }}>{tr.instructions}</span>}
                                {!showEn && showTr && <span style={{ fontFamily: "'Noto Sans', sans-serif" }}>{tr?.instructions || item.instructions || "—"}</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No medications added.</p>
                );
              })()}

              {/* Advice */}
              {(adviceValue || consultation?.advice) && (() => {
                const enAdvice = adviceValue || consultation?.advice;
                const trAdvice = previewTranslation?.advice;
                const showEn = previewDisplayMode !== "translated" || !trAdvice;
                const showTr = previewDisplayMode !== "english" && !!trAdvice;
                const isBilingual = previewDisplayMode === "bilingual" && !!trAdvice;
                return (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Advice</p>
                    {showEn && <p className="text-sm whitespace-pre-wrap">{enAdvice}</p>}
                    {isBilingual && trAdvice && trAdvice !== enAdvice && <p className="text-sm whitespace-pre-wrap mt-0.5 text-blue-700 dark:text-blue-400" style={{ fontFamily: "'Noto Sans', sans-serif" }}>{trAdvice}</p>}
                    {!showEn && showTr && <p className="text-sm whitespace-pre-wrap" style={{ fontFamily: "'Noto Sans', sans-serif" }}>{trAdvice}</p>}
                  </div>
                );
              })()}

              {/* Follow-up */}
              {consultation?.followUpDate && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Follow-up</p>
                  <p className="text-sm">{consultation.followUpDate}
                    {consultation.followUpNotes && <span className="text-muted-foreground"> — {consultation.followUpNotes}</span>}
                  </p>
                </div>
              )}

              {/* Footer actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="outline" onClick={() => { setShowRxPreview(false); setPreviewTranslation(null); }}>← Back to Edit</Button>
                <Button
                  variant="outline"
                  onClick={() => handleAddPrescription(true)}
                  disabled={createPrescriptionMutation.isPending}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Save &amp; Print
                </Button>
                <Button onClick={() => handleAddPrescription(false)} disabled={createPrescriptionMutation.isPending}>
                  {createPrescriptionMutation.isPending ? "Saving…" : "Save Prescription"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex gap-0 overflow-hidden min-h-0">
              {/* LEFT: Drug Picker */}
              <div className="w-[340px] shrink-0 flex flex-col gap-2 overflow-hidden border-r border-border pr-4 mr-4">
                {/* ── Drug Picker ── */}
                {(() => {
                  const freq = getDrugFreq();
                  const q = drugPickerSearch.toLowerCase();
                  const filtered = drugs.filter(d =>
                    !q ||
                    d.name.toLowerCase().includes(q) ||
                    (d.genericName ?? "").toLowerCase().includes(q) ||
                    (d.category ?? "").toLowerCase().includes(q)
                  );
                  const sorted = [...filtered].sort((a, b) => (freq[b.id] ?? 0) - (freq[a.id] ?? 0));
                  const hasFrequent = sorted.some(d => (freq[d.id] ?? 0) > 0);
                  const frequentDrugs = sorted.filter(d => (freq[d.id] ?? 0) > 0);
                  const otherDrugs = sorted.filter(d => (freq[d.id] ?? 0) === 0);

                  const toggleDrug = (id: string) => {
                    setSelectedDrugIds(prev => {
                      const next = new Set(prev);
                      next.has(id) ? next.delete(id) : next.add(id);
                      return next;
                    });
                  };

                  const renderRow = (d: typeof drugs[0]) => (
                    <div
                      key={d.id}
                      onClick={() => toggleDrug(d.id)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer select-none text-xs transition-colors ${
                        selectedDrugIds.has(d.id)
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted/60 border border-transparent"
                      }`}
                    >
                      <input
                        type="checkbox"
                        readOnly
                        checked={selectedDrugIds.has(d.id)}
                        className="h-3 w-3 accent-primary pointer-events-none"
                      />
                      <span className="font-medium flex-1 truncate">{d.name}</span>
                      {d.genericName && <span className="text-muted-foreground truncate max-w-[90px]">{d.genericName}</span>}
                      {d.defaultDosage && <span className="text-muted-foreground shrink-0">{d.defaultDosage}</span>}
                      {(freq[d.id] ?? 0) > 0 && <span className="shrink-0 text-amber-500" title={`Used ${freq[d.id]} time(s)`}>⭐</span>}
                    </div>
                  );

                  return (
                    <div className="flex flex-col flex-1 overflow-hidden gap-2">
                      <div className="flex items-center gap-2 shrink-0">
                        <Input
                          className="h-7 text-xs flex-1"
                          placeholder="Search drugs…"
                          value={drugPickerSearch}
                          onChange={e => setDrugPickerSearch(e.target.value)}
                        />
                        {selectedDrugIds.size > 0 && (
                          <Button size="sm" className="h-7 text-xs shrink-0" onClick={handleAddSelectedDrugs}>
                            <Plus className="h-3 w-3 mr-1" /> Add {selectedDrugIds.size}
                          </Button>
                        )}
                      </div>
                      <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-muted/20 p-2 space-y-0.5 min-h-0">
                        {filtered.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-3">No drugs match your search</p>
                        )}
                        {!q && hasFrequent && (
                          <>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2 pt-1">⭐ Frequently Used</p>
                            {frequentDrugs.map(renderRow)}
                            {otherDrugs.length > 0 && <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2 pt-2">All Drugs</p>}
                          </>
                        )}
                        {(!q && hasFrequent ? otherDrugs : sorted).map(renderRow)}
                      </div>
                    </div>
                  );
                })()}

              </div>
              {/* RIGHT: Drug Table + Footer */}
              <div className="flex-1 flex flex-col gap-3 overflow-hidden min-h-0">
                {/* ── Editable drug rows ── */}
                <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">
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
                            <Input
                              className="h-7 text-xs"
                              value={item.drugName}
                              onChange={e => updateDrugRow(i, "drugName", e.target.value)}
                              placeholder="Drug name"
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
                {/* ── Footer ── */}
                <div className="shrink-0 flex items-center justify-between gap-2 pt-2 border-t border-border">
                  <Button variant="outline" size="sm" onClick={addDrugRow}>
                    <Plus className="h-3 w-3 mr-1" /> Add Row
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setShowPrescriptionModal(false); setEditRxId(null); }}>Cancel</Button>
                    <Button variant="outline" size="sm" onClick={() => setShowRxPreview(true)}>
                      <FileText className="mr-2 h-4 w-4" />
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddPrescription(true)}
                      disabled={createPrescriptionMutation.isPending || updatePrescriptionMutation.isPending}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Save &amp; Print
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAddPrescription(false)}
                      disabled={createPrescriptionMutation.isPending || updatePrescriptionMutation.isPending}
                    >
                      {editRxId ? "Update Prescription" : "Save Prescription"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Rx Template Floating Window ─────────────────────────────────────── */}
      <Dialog open={showRxTemplateDialog} onOpenChange={v => { setShowRxTemplateDialog(v); if (!v) setSelectedTemplateIds(new Set()); }}>
        <DialogContent className="max-w-md flex flex-col" style={{ maxHeight: "80vh" }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookMarked className="h-4 w-4" /> Prescription Templates
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-sm">
            {(() => {
              const favs   = getRxFavs();
              const recent = getRxRecent();
              if (favs.length === 0 && recent.length === 0) return (
                <p className="text-muted-foreground text-center py-6 text-xs">
                  No templates yet — fill in drugs and save as a template to reuse them.
                </p>
              );
              return (
                <>
                  {favs.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                        <Star className="h-3 w-3" /> Saved Templates
                      </p>
                      {favs.map(t => {
                        const checked = selectedTemplateIds.has(t.id);
                        return (
                          <div
                            key={t.id}
                            className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
                            onClick={() => setSelectedTemplateIds(prev => { const s = new Set(prev); checked ? s.delete(t.id) : s.add(t.id); return s; })}
                          >
                            <Checkbox checked={checked} className="mt-0.5 shrink-0" onCheckedChange={() => {}} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{rxTemplateLabel(t)}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {t.items.filter(i => i.drugName).map(i => i.drugName).join(", ")}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {t.items.filter(i => i.drugName).length} drug(s)
                              </p>
                            </div>
                            <div className="flex flex-col gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                              <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => applyRxTemplate(t)}>Apply</Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => persistRxFavs(getRxFavs().filter(f => f.id !== t.id))}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {recent.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                        <Clock className="h-3 w-3" /> Recently Used
                      </p>
                      {recent.map(t => {
                        const checked = selectedTemplateIds.has(t.id);
                        return (
                          <div
                            key={t.id}
                            className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
                            onClick={() => setSelectedTemplateIds(prev => { const s = new Set(prev); checked ? s.delete(t.id) : s.add(t.id); return s; })}
                          >
                            <Checkbox checked={checked} className="mt-0.5 shrink-0" onCheckedChange={() => {}} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{rxTemplateLabel(t)}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {t.items.filter(i => i.drugName).map(i => i.drugName).join(", ")}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {fmtDateTime(t.savedAt)} · {t.items.filter(i => i.drugName).length} drug(s)
                              </p>
                            </div>
                            <div className="flex flex-col gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                              <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => applyRxTemplate(t)}>Apply</Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => persistRxRecent(getRxRecent().filter(r => r.id !== t.id))}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          <div className="border-t border-border pt-3 space-y-3">
            <div className="flex gap-1.5">
              <Input
                className="h-8 text-xs flex-1"
                value={rxFavName}
                onChange={e => setRxFavName(e.target.value)}
                placeholder="Save current drugs as template…"
                onKeyDown={e => e.key === "Enter" && saveRxFav()}
              />
              <Button type="button" size="sm" className="h-8 px-3 text-xs shrink-0" onClick={saveRxFav}>
                <Star className="h-3 w-3 mr-1" /> Save
              </Button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {selectedTemplateIds.size > 0 ? `${selectedTemplateIds.size} selected` : "Select templates to combine"}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setShowRxTemplateDialog(false); setSelectedTemplateIds(new Set()); }}>
                  Cancel
                </Button>
                <Button size="sm" disabled={selectedTemplateIds.size === 0} onClick={applySelectedTemplates}>
                  Apply Selected{selectedTemplateIds.size > 0 ? ` (${selectedTemplateIds.size})` : ""}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Thanking Letter Modal */}
      <Dialog open={showThankingLetter} onOpenChange={setShowThankingLetter}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0">
          <div className="grid grid-cols-1 md:grid-cols-[380px_1fr]">
            {/* ── Form panel ── */}
            <div className="p-6 border-r border-border overflow-y-auto max-h-[85vh]">
              <DialogHeader className="mb-4">
                <DialogTitle>Thanking Letter to Referring Doctor</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
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
                <div className="space-y-1">
                  <Label className="text-xs">Additional Notes</Label>
                  <Textarea
                    value={thankingAdditionalNotes}
                    onChange={e => setThankingAdditionalNotes(e.target.value)}
                    rows={4}
                    placeholder="Any additional clinical details, treatment summary, follow-up instructions..."
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowThankingLetter(false)}>Close</Button>
                  <Button onClick={() => handlePrintLetter("thanking-letter-content", "Thanking Letter")}>
                    <Printer className="mr-2 h-4 w-4" /> Print Letter
                  </Button>
                </div>
              </div>
            </div>

            {/* ── Preview panel ── */}
            <div className="bg-muted/30 p-6 overflow-y-auto max-h-[85vh]">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Live Preview</p>
              <div
                id="thanking-letter-content"
                className="bg-white text-gray-900 rounded border-2 border-gray-200 p-8 text-[11px] leading-relaxed font-serif shadow-sm"
              >
                {/* Clinic header */}
                <div className="text-center border-b-2 border-blue-600 pb-4 mb-5">
                  <p className="text-sm font-bold text-blue-700 not-italic">
                    {(clinicSettings as unknown as Record<string, string> | undefined)?.clinicName ?? "ClinicOS Healthcare"}
                  </p>
                  {(clinicSettings as unknown as Record<string, string> | undefined)?.address && (
                    <p className="text-gray-500 not-italic text-[10px] mt-0.5">
                      {(clinicSettings as unknown as Record<string, string>).address}
                    </p>
                  )}
                  {(clinicSettings as unknown as Record<string, string> | undefined)?.phone && (
                    <p className="text-gray-500 not-italic text-[10px]">
                      Tel: {(clinicSettings as unknown as Record<string, string>).phone}
                    </p>
                  )}
                </div>

                <p><strong>Date:</strong> {fmtDate(new Date())}</p>
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
                {thankingAdditionalNotes && (
                  <>
                    <br />
                    <p>{thankingAdditionalNotes}</p>
                  </>
                )}
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
                <p>Yours sincerely,</p>
                <br /><br />
                <p><strong>{consultation?.doctorName ?? "_______________"}</strong></p>
                <p className="not-italic text-gray-600">
                  {(clinicSettings as unknown as Record<string, string> | undefined)?.clinicName ?? ""}
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Referral Letter Modal */}
      <Dialog open={showReferralLetter} onOpenChange={setShowReferralLetter}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0">
          <div className="grid grid-cols-1 md:grid-cols-[380px_1fr]">
            {/* ── Form panel ── */}
            <div className="p-6 border-r border-border overflow-y-auto max-h-[85vh]">
              <DialogHeader className="mb-4">
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
                    rows={3}
                    placeholder="Specific concerns, investigations requested, urgency..."
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowReferralLetter(false)}>Close</Button>
                  <Button onClick={() => handlePrintLetter("referral-letter-content", "Referral Letter")}>
                    <Printer className="mr-2 h-4 w-4" /> Print Letter
                  </Button>
                </div>
              </div>
            </div>

            {/* ── Preview panel ── */}
            <div className="bg-muted/30 p-6 overflow-y-auto max-h-[85vh]">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Live Preview</p>
              <div
                id="referral-letter-content"
                className="bg-white text-gray-900 rounded border-2 border-gray-200 p-8 text-[11px] leading-relaxed font-serif shadow-sm"
              >
                {/* Clinic header */}
                <div className="text-center border-b-2 border-blue-600 pb-4 mb-5">
                  <p className="text-sm font-bold text-blue-700 not-italic">
                    {(clinicSettings as unknown as Record<string, string> | undefined)?.clinicName ?? "ClinicOS Healthcare"}
                  </p>
                  {(clinicSettings as unknown as Record<string, string> | undefined)?.address && (
                    <p className="text-gray-500 not-italic text-[10px] mt-0.5">
                      {(clinicSettings as unknown as Record<string, string>).address}
                    </p>
                  )}
                  {(clinicSettings as unknown as Record<string, string> | undefined)?.phone && (
                    <p className="text-gray-500 not-italic text-[10px]">
                      Tel: {(clinicSettings as unknown as Record<string, string>).phone}
                    </p>
                  )}
                </div>

                <p><strong>Date:</strong> {fmtDate(new Date())}</p>
                <br />
                <p><strong>To,</strong></p>
                <p>{referralToDoctor || "Dr. _______________"}</p>
                <p>{referralToSpecialty ? `Consultant — ${referralToSpecialty}` : "_______________"}</p>
                {referralToAddress && <p>{referralToAddress}</p>}
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
                <p>Yours sincerely,</p>
                <br /><br />
                <p><strong>{consultation?.doctorName ?? "_______________"}</strong></p>
                <p className="not-italic text-gray-600">
                  {(clinicSettings as unknown as Record<string, string> | undefined)?.clinicName ?? ""}
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Invoice Form Modal ──────────────────────────────────────────────── */}
      <Dialog open={showInvoiceModal} onOpenChange={(open) => !open && setShowInvoiceModal(false)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              {editingInvoiceId ? "Edit Invoice" : "New Invoice"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            {/* Column headers */}
            <div className="grid grid-cols-[130px_1fr_56px_84px_60px_64px_32px] gap-2 text-xs font-medium text-muted-foreground px-1">
              <span>Charge Type</span>
              <span>Description</span>
              <span className="text-center">Qty</span>
              <span className="text-right">Unit Price</span>
              <span className="text-right">Disc (₹)</span>
              <span className="text-right">Total</span>
              <span></span>
            </div>
            {/* Line items */}
            {invItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-[130px_1fr_56px_84px_60px_64px_32px] gap-2 items-center">
                <Select
                  value={item.chargeTypeId}
                  onValueChange={v => {
                    const ct = (chargeTypes ?? []).find(c => c.id === v);
                    setInvItems(prev => prev.map((it, i) => {
                      if (i !== idx) return it;
                      const u = { ...it, chargeTypeId: v };
                      if (ct) {
                        u.unitPrice = ct.unitPrice;
                        if (!u.description) u.description = ct.name;
                        u.total = calcInvItemTotal(u.quantity, ct.unitPrice, u.discount);
                      }
                      return u;
                    }));
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=" ">None</SelectItem>
                    {(chargeTypes ?? []).map(ct => (
                      <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="h-8 text-xs"
                  placeholder="Description *"
                  value={item.description}
                  onChange={e => updateInvItem(idx, "description", e.target.value)}
                />
                <Input
                  className="h-8 text-xs text-center"
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={e => updateInvItem(idx, "quantity", +e.target.value)}
                />
                <Input
                  className="h-8 text-xs text-right"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={item.unitPrice || ""}
                  onChange={e => updateInvItem(idx, "unitPrice", +e.target.value)}
                />
                <Input
                  className="h-8 text-xs text-right"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={item.discount || ""}
                  onChange={e => updateInvItem(idx, "discount", +e.target.value)}
                />
                <span className="text-xs font-medium text-right pr-1">₹{item.total.toFixed(2)}</span>
                <Button
                  size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setInvItems(prev => prev.filter((_, i) => i !== idx))}
                  disabled={invItems.length === 1}
                ><X className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
            <Button
              size="sm" variant="outline" className="mt-1"
              onClick={() => setInvItems(prev => [...prev, blankInvItem()])}
            >
              <Plus className="h-3 w-3 mr-1" /> Add Item
            </Button>

            {/* Totals + discount */}
            <div className="flex flex-col items-end gap-2 border-t pt-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Invoice Discount (₹)</span>
                <Input
                  type="number" min="0" step="0.01"
                  className="w-24 h-7 text-xs text-right"
                  value={invDiscount || ""}
                  onChange={e => setInvDiscount(+e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="flex gap-6 text-sm">
                <span className="text-muted-foreground text-xs">Subtotal: <span className="font-medium text-foreground">₹{invSubtotal.toFixed(2)}</span></span>
                {invDiscount > 0 && (
                  <span className="text-muted-foreground text-xs">Discount: <span className="font-medium text-red-600">-₹{(invSubtotal - invTotal).toFixed(2)}</span></span>
                )}
                <span className="font-semibold">Total: ₹{invTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea
                rows={2}
                placeholder="Any notes for this invoice..."
                value={invoiceNotes}
                onChange={e => setInvoiceNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvoiceModal(false)}>Cancel</Button>
            <Button
              variant="outline"
              onClick={() => handleSaveInvoice("draft")}
              disabled={createInvoiceMutation.isPending || updateInvoiceMutation.isPending}
            >Save as Draft</Button>
            <Button
              onClick={() => handleSaveInvoice("pending")}
              disabled={createInvoiceMutation.isPending || updateInvoiceMutation.isPending}
            >
              {editingInvoiceId ? "Update Invoice" : "Create Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Record Payment Modal ────────────────────────────────────────────── */}
      <Dialog open={!!recordPayingId} onOpenChange={(open) => !open && setRecordPayingId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              Record Payment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Amount (₹) <span className="text-destructive">*</span></Label>
              <Input
                type="number" min="0" step="0.01"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Payment Mode <span className="text-destructive">*</span></Label>
              <Select value={payMode} onValueChange={v => setPayMode(v as "cash" | "card" | "upi" | "insurance")}>
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
                value={payRef}
                onChange={e => setPayRef(e.target.value)}
                placeholder="UTR / transaction ID (optional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordPayingId(null)}>Cancel</Button>
            <Button
              onClick={handleRecordPayment}
              disabled={!payAmount || recordPaymentMutation.isPending}
            >Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
