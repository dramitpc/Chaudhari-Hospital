import { useEffect } from "react";
import { useGetClinicSettings, useUpdateClinicSettings, getGetClinicSettingsQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "SGD", "AED"];
const TIMEZONES = ["Asia/Kolkata", "Asia/Singapore", "America/New_York", "America/Los_Angeles", "Europe/London", "UTC"];

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetClinicSettings({ query: { queryKey: getGetClinicSettingsQueryKey() } });
  const mutation = useUpdateClinicSettings();
  const { register, handleSubmit, reset, setValue } = useForm();

  useEffect(() => {
    if (settings) reset(settings);
  }, [settings, reset]);

  const onSubmit = (data: Record<string, unknown>) => {
    mutation.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Settings saved" });
        queryClient.invalidateQueries({ queryKey: getGetClinicSettingsQueryKey() });
      },
      onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
    });
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clinic Settings</h1>
        <p className="text-sm text-muted-foreground">Configure hospital / clinic information</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold border-b border-border pb-2">Clinic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label>Clinic Name</Label>
              <Input {...register("clinicName")} placeholder="City General Hospital" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Address</Label>
              <Input {...register("address")} placeholder="123 Healthcare Ave, City" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input {...register("phone")} placeholder="+1-555-0100" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input {...register("email")} placeholder="admin@hospital.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input {...register("website")} placeholder="https://hospital.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Registration Number</Label>
              <Input {...register("registrationNumber")} placeholder="HOS-2024-001" />
            </div>
            <div className="space-y-1.5">
              <Label>Tax ID</Label>
              <Input {...register("taxId")} placeholder="TAX123456" />
            </div>
            <div className="space-y-1.5">
              <Label>Default Consultation Fee</Label>
              <Input type="number" step="0.01" {...register("defaultConsultationFee")} placeholder="500" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold border-b border-border pb-2">System Configuration</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select defaultValue={settings?.currency ?? "INR"} onValueChange={v => setValue("currency", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Select defaultValue={settings?.timezone ?? "Asia/Kolkata"} onValueChange={v => setValue("timezone", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Session Timeout (minutes)</Label>
              <Input type="number" min="1" max="480" {...register("sessionTimeoutMinutes")} />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending} data-testid="btn-save-settings">
            {mutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}
