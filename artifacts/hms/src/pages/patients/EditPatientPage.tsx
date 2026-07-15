import { useEffect, useState } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
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

function composeAgeString(y: string, m: string, d: string): string {
  const parts: string[] = [];
  if (parseInt(y) > 0) parts.push(`${parseInt(y)}y`);
  if (parseInt(m) > 0) parts.push(`${parseInt(m)}m`);
  if (parseInt(d) > 0) parts.push(`${parseInt(d)}d`);
  return parts.join(" ");
}

function parseAgeString(age: string): { years: string; months: string; days: string } {
  if (!age) return { years: "", months: "", days: "" };
  if (/^\d+$/.test(age.trim())) return { years: age.trim(), months: "", days: "" };
  const yMatch = age.match(/(\d+)\s*y/);
  const mMatch = age.match(/(\d+)\s*m/);
  const dMatch = age.match(/(\d+)\s*d/);
  return {
    years: yMatch ? yMatch[1] : "",
    months: mMatch ? mMatch[1] : "",
    days: dMatch ? dMatch[1] : "",
  };
}

function calcAgeComponents(dob: string): { years: number; months: number; days: number } | null {
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  let days = today.getDate() - birth.getDate();
  if (days < 0) { months--; days += new Date(today.getFullYear(), today.getMonth(), 0).getDate(); }
  if (months < 0) { years--; months += 12; }
  if (years < 0) return null;
  return { years, months, days };
}

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
  const search = useSearch();
  const backTo = new URLSearchParams(search).get("from") === "queue" ? "/queue" : `/patients/${id}`;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: patient, isLoading } = useGetPatient(id, {
    query: { enabled: !!id, queryKey: getGetPatientQueryKey(id) }
  });

  const { register, handleSubmit, reset, control, watch, setValue } = useForm();
  const mutation = useUpdatePatient();

  const [ageYears, setAgeYears] = useState("");
  const [ageMonths, setAgeMonths] = useState("");
  const [ageDays, setAgeDays] = useState("");

  useEffect(() => {
    if (patient) {
      reset(patient);
      const parsed = parseAgeString(patient.age ?? "");
      setAgeYears(parsed.years);
      setAgeMonths(parsed.months);
      setAgeDays(parsed.days);
    }
  }, [patient, reset]);

  const dobValue = watch("dateOfBirth");
  useEffect(() => {
    if (!dobValue) return;
    const c = calcAgeComponents(dobValue);
    if (c) {
      const y = String(c.years);
      const m = String(c.months);
      const d = String(c.days);
      setAgeYears(y);
      setAgeMonths(m);
      setAgeDays(d);
      setValue("age", composeAgeString(y, m, d) || undefined);
    }
  }, [dobValue, setValue]);

  const onSubmit = (data: Record<string, unknown>) => {
    const payload = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== null && v !== undefined)
    );
    mutation.mutate({ id, data: payload }, {
      onSuccess: () => {
        toast({ title: "Patient updated" });
        queryClient.invalidateQueries({ queryKey: getGetPatientQueryKey(id) });
        setLocation(backTo);
      },
      onError: () => toast({ title: "Error", description: "Failed to update patient", variant: "destructive" }),
    });
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation(backTo)}>
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
            <div className="col-span-2 flex gap-2 items-start">
              <div className="space-y-1.5 w-28 shrink-0">
                <Label>Salutation</Label>
                <Select onValueChange={(v) => {
                  setValue("salutation", v);
                  if (["Mr.", "Master"].includes(v)) setValue("gender", "male");
                  else if (["Mrs.", "Ms.", "Miss"].includes(v)) setValue("gender", "female");
                }} value={watch("salutation") ?? ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Mr.", "Mrs.", "Ms.", "Miss", "Dr.", "Master", "Baby", "Baby of"].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex-1">
                <Label>Full Name</Label>
                <Input {...register("fullName")} />
              </div>
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
              <Label>Age <span className="text-muted-foreground text-xs">(auto-filled from DOB)</span></Label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    type="number" min="0" max="150"
                    value={ageYears}
                    readOnly={!!dobValue}
                    onChange={e => { setAgeYears(e.target.value); setValue("age", composeAgeString(e.target.value, ageMonths, ageDays) || undefined); }}
                    placeholder="0"
                    className={`pr-10 ${dobValue ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">yr</span>
                </div>
                <div className="flex-1 relative">
                  <Input
                    type="number" min="0" max="11"
                    value={ageMonths}
                    readOnly={!!dobValue}
                    onChange={e => { setAgeMonths(e.target.value); setValue("age", composeAgeString(ageYears, e.target.value, ageDays) || undefined); }}
                    placeholder="0"
                    className={`pr-10 ${dobValue ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">mo</span>
                </div>
                <div className="flex-1 relative">
                  <Input
                    type="number" min="0" max="31"
                    value={ageDays}
                    readOnly={!!dobValue}
                    onChange={e => { setAgeDays(e.target.value); setValue("age", composeAgeString(ageYears, ageMonths, e.target.value) || undefined); }}
                    placeholder="0"
                    className={`pr-10 ${dobValue ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">d</span>
                </div>
              </div>
              {dobValue && <p className="text-xs text-muted-foreground">Auto-calculated from Date of Birth</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select
                value={watch("gender") ?? ""}
                onValueChange={v => setValue("gender", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
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
                  <Select value={field.value ?? "mr"} onValueChange={field.onChange}>
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
          <Button type="button" variant="outline" onClick={() => setLocation(backTo)}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
