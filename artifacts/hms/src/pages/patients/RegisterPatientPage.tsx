import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { useRegisterPatient } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

type FormValues = {
  fullName: string;
  dateOfBirth: string;
  gender: "male" | "female" | "other";
  phone?: string;
  email?: string;
  address?: string;
  bloodGroup?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  allergies?: string;
  medicalHistory?: string;
  surgicalHistory?: string;
  familyHistory?: string;
  currentMedications?: string;
};

export default function RegisterPatientPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>();
  const mutation = useRegisterPatient();

  const onSubmit = (data: FormValues) => {
    mutation.mutate({ data }, {
      onSuccess: (res) => {
        toast({ title: "Patient registered", description: `ID: ${res.patientId}` });
        setLocation(`/patients/${res.id}`);
      },
      onError: () => toast({ title: "Error", description: "Failed to register patient", variant: "destructive" }),
    });
  };

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
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input {...register("fullName", { required: true })} data-testid="input-fullname" placeholder="Patient full name" />
              {errors.fullName && <p className="text-xs text-destructive">Required</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Date of Birth *</Label>
              <Input type="date" {...register("dateOfBirth", { required: true })} data-testid="input-dob" />
              {errors.dateOfBirth && <p className="text-xs text-destructive">Required</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Gender *</Label>
              <Select onValueChange={(v) => setValue("gender", v as "male" | "female" | "other")}>
                <SelectTrigger data-testid="select-gender">
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

        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-foreground border-b border-border pb-2">Medical History</h2>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Known Allergies</Label>
              <Textarea {...register("allergies")} rows={2} placeholder="Drug allergies, food allergies..." />
            </div>
            <div className="space-y-1.5">
              <Label>Past Medical History</Label>
              <Textarea {...register("medicalHistory")} rows={2} placeholder="Chronic conditions, past illnesses..." />
            </div>
            <div className="space-y-1.5">
              <Label>Surgical History</Label>
              <Textarea {...register("surgicalHistory")} rows={2} placeholder="Previous surgeries, procedures..." />
            </div>
            <div className="space-y-1.5">
              <Label>Family History</Label>
              <Textarea {...register("familyHistory")} rows={2} placeholder="Family medical conditions..." />
            </div>
            <div className="space-y-1.5">
              <Label>Current Medications</Label>
              <Textarea {...register("currentMedications")} rows={2} placeholder="Ongoing medications..." />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => setLocation("/patients")}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending} data-testid="btn-submit-patient">
            {mutation.isPending ? "Registering..." : "Register Patient"}
          </Button>
        </div>
      </form>
    </div>
  );
}
