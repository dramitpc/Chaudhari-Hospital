import { useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetPatient, useUpdatePatient, getGetPatientQueryKey } from "@workspace/api-client-react";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function EditPatientPage() {
  const [, params] = useRoute("/patients/:id/edit");
  const id = params?.id ?? "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: patient, isLoading } = useGetPatient(id, {
    query: { enabled: !!id, queryKey: getGetPatientQueryKey(id) }
  });

  const { register, handleSubmit, reset, control, watch, setValue } = useForm();
  const mutation = useUpdatePatient();

  useEffect(() => {
    if (patient) reset(patient);
  }, [patient, reset]);

  const dobValue = watch("dateOfBirth");
  useEffect(() => {
    if (!dobValue) return;
    const birth = new Date(dobValue);
    if (isNaN(birth.getTime())) return;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    if (age >= 0) setValue("age", String(age));
  }, [dobValue, setValue]);

  const onSubmit = (data: Record<string, unknown>) => {
    const payload = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== null && v !== undefined)
    );
    mutation.mutate({ id, data: payload }, {
      onSuccess: () => {
        toast({ title: "Patient updated" });
        queryClient.invalidateQueries({ queryKey: getGetPatientQueryKey(id) });
        setLocation(`/patients/${id}`);
      },
      onError: () => toast({ title: "Error", description: "Failed to update patient", variant: "destructive" }),
    });
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation(`/patients/${id}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Edit Patient</h1>
          <p className="text-sm text-muted-foreground">{patient?.patientId}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold border-b border-border pb-2">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>Full Name</Label>
              <Input {...register("fullName")} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input {...register("phone")} />
            </div>
            <div className="space-y-1.5">
              <Label>Date of Birth</Label>
              <Input type="date" {...register("dateOfBirth")} />
            </div>
            <div className="space-y-1.5">
              <Label>Age (years)</Label>
              <Input
                type="number"
                min="0"
                max="150"
                {...register("age")}
                readOnly={!!dobValue}
                placeholder={dobValue ? "Calculated from DOB" : "e.g. 35"}
                className={dobValue ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}
              />
              {dobValue && (
                <p className="text-xs text-muted-foreground">Age is auto-calculated from Date of Birth</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input {...register("email")} />
            </div>
            <div className="space-y-1.5">
              <Label>Blood Group</Label>
              <Input {...register("bloodGroup")} placeholder="A+, B-, etc." />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Textarea {...register("address")} rows={2} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold border-b border-border pb-2">Referring Doctor &amp; Preferences</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Referring Doctor Name</Label>
              <Input {...register("referringDoctorName")} placeholder="Dr. Name" />
            </div>
            <div className="space-y-1.5">
              <Label>Referring Doctor Mobile</Label>
              <Input {...register("referringDoctorPhone")} placeholder="Mobile number" />
            </div>
            <div className="space-y-1.5">
              <Label>Preferred Prescription Language</Label>
              <Controller
                name="preferredLanguage"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? "en"} onValueChange={field.onChange}>
                    <SelectTrigger data-testid="select-preferred-language">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map(l => (
                        <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">Auto-selected when generating prescriptions</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold border-b border-border pb-2">Medical History</h2>
          {(["allergies", "medicalHistory", "surgicalHistory", "familyHistory", "currentMedications"] as const).map(field => (
            <div key={field} className="space-y-1.5">
              <Label>{field.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}</Label>
              <Textarea {...register(field)} rows={2} />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => setLocation(`/patients/${id}`)}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
