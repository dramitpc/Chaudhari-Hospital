import { useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { fmtDate } from "@/lib/dateUtils";
import {
  useGetPatient, useGetPatientHistory, useAddVitals, useGetPatientTimeline,
  getGetPatientQueryKey, getGetPatientHistoryQueryKey, getGetPatientTimelineQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { ArrowLeft, Edit, FileText, Receipt } from "lucide-react";

function calcAge(dob: string | null | undefined) {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  return now.getFullYear() - birth.getFullYear() - (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
}

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value || <span className="text-muted-foreground">—</span>}</span>
    </div>
  );
}

export default function PatientDetailPage() {
  const [, params] = useRoute("/patients/:id");
  const id = params?.id ?? "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: patient, isLoading } = useGetPatient(id, {
    query: { enabled: !!id, queryKey: getGetPatientQueryKey(id) }
  });
  const { data: history } = useGetPatientHistory(id, {
    query: { enabled: !!id, queryKey: getGetPatientHistoryQueryKey(id) }
  });
  const { data: timeline } = useGetPatientTimeline(id, {
    query: { enabled: !!id, queryKey: getGetPatientTimelineQueryKey(id) }
  });

  const addVitalsMutation = useAddVitals();
  const { register, handleSubmit, reset } = useForm();

  const onVitalsSubmit = (data: Record<string, string>) => {
    addVitalsMutation.mutate({ id, data: {
      temperature: data.temperature || undefined,
      bloodPressureSystolic: data.bpSys ? parseInt(data.bpSys) : undefined,
      bloodPressureDiastolic: data.bpDia ? parseInt(data.bpDia) : undefined,
      pulseRate: data.pulse ? parseInt(data.pulse) : undefined,
      oxygenSaturation: data.spo2 ? parseFloat(data.spo2) : undefined,
      weight: data.weight ? parseFloat(data.weight) : undefined,
      height: data.height ? parseFloat(data.height) : undefined,
      notes: data.notes || undefined,
    }}, {
      onSuccess: () => {
        toast({ title: "Vitals recorded" });
        reset();
        queryClient.invalidateQueries({ queryKey: getGetPatientHistoryQueryKey(id) });
      },
    });
  };

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  if (!patient) {
    return <div className="p-8 text-center text-muted-foreground">Patient not found</div>;
  }

  const typeColors: Record<string, string> = {
    consultation: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    prescription: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    vitals: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
    billing: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    certificate: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/patients")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">{patient.patientId}</Badge>
              {patient.bloodGroup && <Badge variant="secondary">{patient.bloodGroup}</Badge>}
            </div>
            <h1 className="text-2xl font-bold mt-1">{patient.fullName}</h1>
            <p className="text-sm text-muted-foreground">
              {(calcAge(patient.dateOfBirth) ?? patient.age) ? `${calcAge(patient.dateOfBirth) ?? patient.age} yrs • ` : ""}{patient.gender} • {patient.phone ?? "No phone"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/billing/new?patientId=${patient.id}`}>
            <Button variant="outline" size="sm">
              <Receipt className="mr-2 h-4 w-4" />
              New Invoice
            </Button>
          </Link>
          <Link href={`/patients/${patient.id}/edit`}>
            <Button variant="outline" size="sm" data-testid="btn-edit-patient">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="demographics">
        <TabsList>
          <TabsTrigger value="demographics">Demographics</TabsTrigger>
          <TabsTrigger value="history">EMR History</TabsTrigger>
          <TabsTrigger value="vitals">Vitals</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="demographics" className="space-y-4 mt-4">
          <div className="rounded-lg border border-border bg-card p-6 grid grid-cols-2 md:grid-cols-3 gap-5">
            <FieldRow label="Full Name" value={patient.fullName} />
            <FieldRow label="Date of Birth" value={patient.dateOfBirth} />
            <FieldRow label="Gender" value={patient.gender} />
            <FieldRow label="Phone" value={patient.phone} />
            <FieldRow label="Email" value={patient.email} />
            <FieldRow label="Blood Group" value={patient.bloodGroup} />
            <FieldRow label="Address" value={patient.address} />
            <FieldRow label="Emergency Contact" value={patient.emergencyContactName} />
            <FieldRow label="Emergency Phone" value={patient.emergencyContactPhone} />
          </div>
          {(patient.allergies || patient.medicalHistory || patient.currentMedications) && (
            <div className="rounded-lg border border-border bg-card p-6 space-y-4">
              <h3 className="font-semibold">Medical Background</h3>
              <FieldRow label="Known Allergies" value={patient.allergies} />
              <FieldRow label="Medical History" value={patient.medicalHistory} />
              <FieldRow label="Surgical History" value={patient.surgicalHistory} />
              <FieldRow label="Family History" value={patient.familyHistory} />
              <FieldRow label="Current Medications" value={patient.currentMedications} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-4">
          {history?.consultations.slice(0, 5).map(c => (
            <Link key={c.id} href={`/consultations/${c.id}`}>
              <div className="rounded-lg border border-border bg-card p-4 hover:bg-muted/30 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{c.visitDate}</span>
                    <span className="text-sm text-muted-foreground ml-3">{c.doctorName}</span>
                  </div>
                  <Badge variant={c.status === "completed" ? "secondary" : "default"}>{c.status}</Badge>
                </div>
                {c.diagnosis && <p className="text-sm text-muted-foreground mt-1">{c.diagnosis}</p>}
              </div>
            </Link>
          ))}
          {(!history?.consultations || history.consultations.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">No consultation history</div>
          )}
        </TabsContent>

        <TabsContent value="vitals" className="mt-4 space-y-4">
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="font-semibold mb-4">Record Vitals</h3>
            <form onSubmit={handleSubmit(onVitalsSubmit)} className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Temperature (°F)</Label>
                <Input {...register("temperature")} placeholder="98.6" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">BP Systolic (mmHg)</Label>
                <Input type="number" {...register("bpSys")} placeholder="120" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">BP Diastolic (mmHg)</Label>
                <Input type="number" {...register("bpDia")} placeholder="80" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Pulse (bpm)</Label>
                <Input type="number" {...register("pulse")} placeholder="72" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">SpO2 (%)</Label>
                <Input type="number" {...register("spo2")} placeholder="98" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Weight (kg)</Label>
                <Input type="number" step="0.1" {...register("weight")} placeholder="70" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Height (cm)</Label>
                <Input type="number" {...register("height")} placeholder="170" />
              </div>
              <div className="flex items-end">
                <Button type="submit" size="sm" className="w-full" disabled={addVitalsMutation.isPending}>
                  Record
                </Button>
              </div>
            </form>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-4 py-2 text-left text-xs text-muted-foreground">Date</th>
                  <th className="px-4 py-2 text-left text-xs text-muted-foreground">BP</th>
                  <th className="px-4 py-2 text-left text-xs text-muted-foreground">Pulse</th>
                  <th className="px-4 py-2 text-left text-xs text-muted-foreground">Temp</th>
                  <th className="px-4 py-2 text-left text-xs text-muted-foreground">SpO2</th>
                  <th className="px-4 py-2 text-left text-xs text-muted-foreground">Weight</th>
                  <th className="px-4 py-2 text-left text-xs text-muted-foreground">BMI</th>
                </tr>
              </thead>
              <tbody>
                {history?.vitals.map(v => (
                  <tr key={v.id} className="border-t border-border">
                    <td className="px-4 py-2">{fmtDate(v.recordedAt)}</td>
                    <td className="px-4 py-2">{v.bloodPressureSystolic && v.bloodPressureDiastolic ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}` : "-"}</td>
                    <td className="px-4 py-2">{v.pulseRate ?? "-"}</td>
                    <td className="px-4 py-2">{v.temperature ?? "-"}</td>
                    <td className="px-4 py-2">{v.oxygenSaturation ? `${v.oxygenSaturation}%` : "-"}</td>
                    <td className="px-4 py-2">{v.weight ? `${v.weight} kg` : "-"}</td>
                    <td className="px-4 py-2">{v.bmi ?? "-"}</td>
                  </tr>
                ))}
                {(!history?.vitals || history.vitals.length === 0) && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">No vitals recorded</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <div className="space-y-3">
            {(timeline ?? []).map((event) => (
              <div key={event.id} className="flex gap-4 p-4 rounded-lg border border-border bg-card">
                <div className="flex-shrink-0">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${typeColors[event.type] ?? "bg-gray-100 text-gray-800"}`}>
                    {event.type}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{event.description}</p>
                  {event.doctorName && <p className="text-xs text-muted-foreground">{event.doctorName}</p>}
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">{event.date}</div>
              </div>
            ))}
            {(!timeline || timeline.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">No timeline events</div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
