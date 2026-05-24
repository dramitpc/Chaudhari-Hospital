import { useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetPatient, useUpdatePatient, getGetPatientQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditPatientPage() {
  const [, params] = useRoute("/patients/:id/edit");
  const id = params?.id ?? "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: patient, isLoading } = useGetPatient(id, {
    query: { enabled: !!id, queryKey: getGetPatientQueryKey(id) }
  });

  const { register, handleSubmit, reset } = useForm();
  const mutation = useUpdatePatient();

  useEffect(() => {
    if (patient) reset(patient);
  }, [patient, reset]);

  const onSubmit = (data: Record<string, unknown>) => {
    mutation.mutate({ id, data }, {
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
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input {...register("fullName")} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input {...register("phone")} />
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
