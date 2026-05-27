import { useRoute, useLocation, Link } from "wouter";
import { useState } from "react";
import {
  useGetConsultation, useUpdateConsultation, useCompleteConsultation,
  useListPrescriptions, useCreatePrescription, useListDrugs,
  useGetPatient, useUpdatePatient,
  getGetConsultationQueryKey, getListPrescriptionsQueryKey, getListDrugsQueryKey, getGetPatientQueryKey
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
import { ArrowLeft, CheckCircle, Plus, Printer, FileText } from "lucide-react";

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
  const [, setLocation] = useLocation();
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

  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [drugItems, setDrugItems] = useState<DrugItem[]>([
    { drugName: "", dosage: "", frequency: "", duration: "", instructions: "" }
  ]);

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

  const handleAddPrescription = () => {
    if (!consultation) return;
    createPrescriptionMutation.mutate({
      data: {
        patientId: consultation.patientId,
        doctorId: consultation.doctorId,
        consultationId: id,
        diagnosis: consultation.diagnosis ?? undefined,
        advice: consultation.advice ?? undefined,
        followUpDate: consultation.followUpDate ?? undefined,
        items: drugItems.filter(i => i.drugName),
      }
    }, {
      onSuccess: () => {
        toast({ title: "Prescription created" });
        queryClient.invalidateQueries({ queryKey: getListPrescriptionsQueryKey({ consultationId: id }) });
        setShowPrescriptionModal(false);
        setDrugItems([{ drugName: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/consultations")}>
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
              {(["soapSubjective", "soapObjective", "soapAssessment", "soapPlan"] as const).map(field => {
                const labels: Record<string, string> = {
                  soapSubjective: "S — Subjective (What the patient reports)",
                  soapObjective: "O — Objective (Examination findings)",
                  soapAssessment: "A — Assessment (Diagnosis, differential)",
                  soapPlan: "P — Plan (Treatment, investigations, follow-up)",
                };
                return (
                  <div key={field} className="space-y-1.5">
                    <Label className="text-xs font-medium">{labels[field]}</Label>
                    <Textarea
                      defaultValue={consultation[field] ?? ""}
                      onBlur={e => handleBlur(field, e.target.value)}
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
              <Button onClick={handleAddPrescription} disabled={createPrescriptionMutation.isPending}>
                Save Prescription
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
