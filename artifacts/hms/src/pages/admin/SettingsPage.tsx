import { useEffect, useState } from "react";
import { useGetClinicSettings, useUpdateClinicSettings, getGetClinicSettingsQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "SGD", "AED"];
const TIMEZONES = ["Asia/Kolkata", "Asia/Singapore", "America/New_York", "America/Los_Angeles", "Europe/London", "UTC"];

// ── Prescription format ───────────────────────────────────────────────────────
type RxFormat = {
  showDiagnosis: boolean;
  showSoap: boolean;
  showInvestigations: boolean;
  showAdvice: boolean;
  showFollowUp: boolean;
  showGenericName: boolean;
  showInstructions: boolean;
  drugStyle: "table" | "list";
  headerAlign: "left" | "center";
  paperSize: "a4" | "a5" | "letter";
  fontSize: "sm" | "md" | "lg";
};

const RX_LS_KEY = "clinicos_rx_format";

const DEFAULT_FORMAT: RxFormat = {
  showDiagnosis: true,
  showSoap: false,
  showInvestigations: false,
  showAdvice: true,
  showFollowUp: true,
  showGenericName: true,
  showInstructions: true,
  drugStyle: "table",
  headerAlign: "center",
  paperSize: "a4",
  fontSize: "sm",
};

function loadRxFormat(): RxFormat {
  try {
    const raw = localStorage.getItem(RX_LS_KEY);
    if (raw) return { ...DEFAULT_FORMAT, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_FORMAT };
}

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

  // Prescription format state (localStorage, auto-saved on change)
  const [rxFmt, setRxFmt] = useState<RxFormat>(loadRxFormat);

  const setRx = <K extends keyof RxFormat>(key: K, value: RxFormat[K]) => {
    const next = { ...rxFmt, [key]: value };
    setRxFmt(next);
    localStorage.setItem(RX_LS_KEY, JSON.stringify(next));
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

      {/* Prescription Format — standalone card, auto-saves to localStorage */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-5">
        <div className="border-b border-border pb-2">
          <h2 className="font-semibold">Prescription Format</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Controls how prescriptions look when printed. Changes apply immediately.</p>
        </div>

        {/* Toggles */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Visible sections</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            {([
              { key: "showDiagnosis",       label: "Diagnosis"           },
              { key: "showSoap",           label: "SOAP notes"          },
              { key: "showInvestigations", label: "Investigations"       },
              { key: "showGenericName",    label: "Generic drug name"   },
              { key: "showInstructions",   label: "Instructions column" },
              { key: "showAdvice",         label: "Advice"              },
              { key: "showFollowUp",       label: "Follow-up date"      },
            ] as { key: keyof RxFormat; label: string }[]).map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <Label htmlFor={`rxfmt-${key}`} className="text-sm font-normal cursor-pointer">{label}</Label>
                <Switch
                  id={`rxfmt-${key}`}
                  checked={rxFmt[key] as boolean}
                  onCheckedChange={v => setRx(key, v as RxFormat[typeof key])}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Selects */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Drug list style</Label>
            <Select value={rxFmt.drugStyle} onValueChange={v => setRx("drugStyle", v as RxFormat["drugStyle"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="table">Table</SelectItem>
                <SelectItem value="list">Rx list (narrative)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Header alignment</Label>
            <Select value={rxFmt.headerAlign} onValueChange={v => setRx("headerAlign", v as RxFormat["headerAlign"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="center">Centre</SelectItem>
                <SelectItem value="left">Left</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Paper size</Label>
            <Select value={rxFmt.paperSize} onValueChange={v => setRx("paperSize", v as RxFormat["paperSize"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="a4">A4</SelectItem>
                <SelectItem value="a5">A5 (half-sheet)</SelectItem>
                <SelectItem value="letter">Letter</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Font size</Label>
            <Select value={rxFmt.fontSize} onValueChange={v => setRx("fontSize", v as RxFormat["fontSize"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sm">Small</SelectItem>
                <SelectItem value="md">Medium</SelectItem>
                <SelectItem value="lg">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
