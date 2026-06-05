import { useForm, useWatch } from "react-hook-form";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useRegisterPatient, useGenerateToken, useListDoctors } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, UserPlus, ListOrdered } from "lucide-react";

type FormValues = {
  salutation?: string;
  fullName: string;
  dateOfBirth?: string;
  age?: string;
  gender: "male" | "female" | "other";
  phone?: string;
  email?: string;
  address?: string;
  bloodGroup?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  referringDoctorName?: string;
  referringDoctorPhone?: string;
};

function calcAge(dob: string): string {
  const today = new Date();
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return "";
  let years = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--;
  return years >= 0 ? String(years) : "";
}

export default function RegisterPatientPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { register, handleSubmit, setValue, watch, control, formState: { errors } } = useForm<FormValues>();
  const selectedGender = watch("gender");
  const registerMutation = useRegisterPatient();
  const tokenMutation = useGenerateToken();
  const addToQueueRef = useRef(false);

  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [visitType, setVisitType] = useState<"new" | "followup">("new");

  const { data: doctorsData } = useListDoctors();
  const doctors = doctorsData?.data ?? [];

  const dobValue = useWatch({ control, name: "dateOfBirth" });

  useEffect(() => {
    if (dobValue) {
      const computed = calcAge(dobValue);
      if (computed) setValue("age", computed);
    }
  }, [dobValue, setValue]);

  const onSubmit = (data: FormValues) => {
    const wantsQueue = addToQueueRef.current;

    if (!data.gender) {
      toast({ title: "Gender required", description: "Please select the patient's gender.", variant: "destructive" });
      return;
    }

    if (wantsQueue && !selectedDoctorId) {
      toast({ title: "Doctor required", description: "Please select a consulting doctor to add patient to the queue.", variant: "destructive" });
      return;
    }

    const payload = {
      ...data,
      dateOfBirth: data.dateOfBirth || undefined,
      age: data.age || undefined,
    };

    registerMutation.mutate({ data: payload }, {
      onSuccess: (patient) => {
        if (wantsQueue) {
          tokenMutation.mutate(
            { data: { patientId: patient.id, doctorId: selectedDoctorId, visitType } },
            {
              onSuccess: (token) => {
                toast({
                  title: "Patient registered & added to queue",
                  description: `${patient.fullName} — Token #${token.tokenNumber}`,
                });
                setLocation("/queue");
              },
              onError: () => {
                toast({
                  title: "Registered, but queue failed",
                  description: `Patient ${patient.patientId} registered. Could not add to queue — try from the Queue page.`,
                  variant: "destructive",
                });
                setLocation(`/patients/${patient.id}`);
              },
            },
          );
        } else {
          toast({ title: "Patient registered", description: `ID: ${patient.patientId}` });
          setLocation(`/patients/${patient.id}`);
        }
      },
      onError: () => toast({ title: "Error", description: "Failed to register patient", variant: "destructive" }),
    });
  };

  const isPending = registerMutation.isPending || tokenMutation.isPending;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/patients")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Register New Patient</h1>
          <p className="text-sm text-muted-foreground">Fill in patient demographics</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-foreground border-b border-border pb-2">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 flex gap-2 items-start">
              <div className="space-y-1.5 w-28 shrink-0">
                <Label>Salutation</Label>
                <Select onValueChange={(v) => setValue("salutation", v)}>
                  <SelectTrigger data-testid="select-salutation">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Mr.", "Mrs.", "Ms.", "Miss", "Dr.", "Master", "Baby"].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex-1">
                <Label>Full Name *</Label>
                <Input {...register("fullName", { required: true })} data-testid="input-fullname" placeholder="Patient full name" />
                {errors.fullName && <p className="text-xs text-destructive">Required</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Date of Birth <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input type="date" {...register("dateOfBirth")} data-testid="input-dob" />
              <p className="text-xs text-muted-foreground">Age is calculated automatically from DOB</p>
            </div>
            <div className="space-y-1.5">
              <Label>Age (years) <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                type="number"
                min="0"
                max="150"
                {...register("age")}
                data-testid="input-age"
                placeholder="e.g. 35"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Gender *</Label>
              <Select onValueChange={(v) => setValue("gender", v as "male" | "female" | "other")}>
                <SelectTrigger data-testid="select-gender" className={!selectedGender ? "border-muted-foreground/40" : ""}>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {!selectedGender && <p className="text-xs text-muted-foreground">Required</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Blood Group</Label>
              <Select onValueChange={(v) => setValue("bloodGroup", v)}>
                <SelectTrigger data-testid="select-blood-group">
                  <SelectValue placeholder="Select blood group" />
                </SelectTrigger>
                <SelectContent>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => (
                    <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input {...register("phone")} data-testid="input-phone" placeholder="+1-555-0100" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" {...register("email")} data-testid="input-email" placeholder="patient@email.com" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Textarea {...register("address")} rows={2} placeholder="Street, City, State" data-testid="input-address" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-foreground border-b border-border pb-2">Emergency Contact</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Contact Name</Label>
              <Input {...register("emergencyContactName")} placeholder="Emergency contact name" />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Phone</Label>
              <Input {...register("emergencyContactPhone")} placeholder="Emergency contact phone" />
            </div>
          </div>
        </div>

        {/* Queue section */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-foreground border-b border-border pb-2">Referring Doctor <span className="text-muted-foreground font-normal text-sm">(optional)</span></h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Referring Doctor Name</Label>
              <Input {...register("referringDoctorName")} placeholder="Dr. Full Name" />
            </div>
            <div className="space-y-1.5">
              <Label>Referring Doctor Mobile</Label>
              <Input {...register("referringDoctorPhone")} placeholder="Mobile number" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 space-y-3">
          <h2 className="font-semibold text-foreground border-b border-border pb-2">Add to OPD Queue <span className="text-muted-foreground font-normal text-sm">(optional)</span></h2>
          <p className="text-sm text-muted-foreground">Select a doctor below and use "Register &amp; Add to Queue" to immediately assign a token.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Consulting Doctor</Label>
              <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                <SelectTrigger data-testid="select-doctor">
                  <SelectValue placeholder="Select doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.fullName}{d.specialization ? ` — ${d.specialization}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Visit Type <span className="text-destructive">*</span></Label>
              <Select value={visitType} onValueChange={(v) => setVisitType(v as "new" | "followup")}>
                <SelectTrigger data-testid="select-visit-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">🆕 New Visit</SelectItem>
                  <SelectItem value="followup">🔄 Follow-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => setLocation("/patients")}>Cancel</Button>
          <Button
            type="submit"
            variant="outline"
            disabled={isPending}
            data-testid="btn-submit-patient"
            onClick={() => { addToQueueRef.current = false; }}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            {registerMutation.isPending && !addToQueueRef.current ? "Registering..." : "Register Patient"}
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            data-testid="btn-submit-and-queue"
            onClick={() => { addToQueueRef.current = true; }}
          >
            <ListOrdered className="h-4 w-4 mr-2" />
            {isPending && addToQueueRef.current ? "Adding to queue..." : "Register & Add to Queue"}
          </Button>
        </div>
      </form>
    </div>
  );
}
