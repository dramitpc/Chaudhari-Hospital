import { useRoute, useLocation, useSearch } from "wouter";
import { useEffect, useState } from "react";
import { useGetPrescription, useGetClinicSettings, getGetPrescriptionQueryKey, getGetClinicSettingsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Printer, Settings2 } from "lucide-react";

type PrescriptionItem = {
  drugName: string;
  genericName?: string | null;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string | null;
  quantity?: number | null;
};

type RxFormat = {
  showDiagnosis: boolean;
  showAdvice: boolean;
  showFollowUp: boolean;
  showGenericName: boolean;
  showInstructions: boolean;
  drugStyle: "table" | "list";
  headerAlign: "left" | "center";
  paperSize: "a4" | "a5" | "letter";
  fontSize: "sm" | "md" | "lg";
};

const DEFAULT_FORMAT: RxFormat = {
  showDiagnosis: true,
  showAdvice: true,
  showFollowUp: true,
  showGenericName: true,
  showInstructions: true,
  drugStyle: "table",
  headerAlign: "center",
  paperSize: "a4",
  fontSize: "sm",
};

const LS_KEY = "clinicos_rx_format";

function loadFormat(): RxFormat {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULT_FORMAT, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_FORMAT };
}

const PAPER_MAX: Record<RxFormat["paperSize"], string> = {
  a4: "max-w-2xl",
  a5: "max-w-sm",
  letter: "max-w-3xl",
};

const FONT_SIZE: Record<RxFormat["fontSize"], string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

export default function PrescriptionDetailPage() {
  const [, params] = useRoute("/prescriptions/:id");
  const id = params?.id ?? "";
  const [, setLocation] = useLocation();
  const search = useSearch();

  const { data: prescription, isLoading } = useGetPrescription(id, {
    query: { enabled: !!id, queryKey: getGetPrescriptionQueryKey(id) }
  });
  const { data: settings } = useGetClinicSettings({ query: { queryKey: getGetClinicSettingsQueryKey() } });

  const [fmt, setFmt] = useState<RxFormat>(loadFormat);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(fmt));
  }, [fmt]);

  const set = <K extends keyof RxFormat>(key: K, value: RxFormat[K]) =>
    setFmt(prev => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (!isLoading && prescription && new URLSearchParams(search).get("print") === "1") {
      const timer = setTimeout(() => window.print(), 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isLoading, prescription, search]);

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!prescription) return <div className="text-center py-8 text-muted-foreground">Prescription not found</div>;

  const items = (prescription.items ?? []) as PrescriptionItem[];
  const textAlign = fmt.headerAlign === "center" ? "text-center" : "text-left";

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/prescriptions")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          {/* Format popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="h-4 w-4 mr-1.5" />
                Format
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-4 space-y-4">
              <p className="text-sm font-semibold">Prescription Format</p>
              <Separator />

              {/* Layout toggles */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sections</p>
                {([
                  { key: "showDiagnosis",    label: "Diagnosis"          },
                  { key: "showGenericName",  label: "Generic drug name"  },
                  { key: "showInstructions", label: "Instructions column" },
                  { key: "showAdvice",       label: "Advice"             },
                  { key: "showFollowUp",     label: "Follow-up date"     },
                ] as { key: keyof RxFormat; label: string }[]).map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label className="text-sm font-normal cursor-pointer" htmlFor={`fmt-${key}`}>{label}</Label>
                    <Switch
                      id={`fmt-${key}`}
                      checked={fmt[key] as boolean}
                      onCheckedChange={v => set(key, v as RxFormat[typeof key])}
                    />
                  </div>
                ))}
              </div>

              <Separator />

              {/* Drug style */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Drug list style</Label>
                <Select value={fmt.drugStyle} onValueChange={v => set("drugStyle", v as RxFormat["drugStyle"])}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="table">Table</SelectItem>
                    <SelectItem value="list">Rx list (narrative)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Header alignment */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Header alignment</Label>
                <Select value={fmt.headerAlign} onValueChange={v => set("headerAlign", v as RxFormat["headerAlign"])}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="center">Centre</SelectItem>
                    <SelectItem value="left">Left</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Paper size */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Paper size</Label>
                <Select value={fmt.paperSize} onValueChange={v => set("paperSize", v as RxFormat["paperSize"])}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4">A4</SelectItem>
                    <SelectItem value="a5">A5 (half-sheet)</SelectItem>
                    <SelectItem value="letter">Letter</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Font size */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Font size</Label>
                <Select value={fmt.fontSize} onValueChange={v => set("fontSize", v as RxFormat["fontSize"])}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sm">Small</SelectItem>
                    <SelectItem value="md">Medium</SelectItem>
                    <SelectItem value="lg">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>

          <Button onClick={() => window.print()} data-testid="btn-print-prescription">
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Prescription body */}
      <div className={`mx-auto bg-white dark:bg-card rounded-lg border border-border p-8 print:border-0 print:shadow-none print:max-w-full ${PAPER_MAX[fmt.paperSize]} ${FONT_SIZE[fmt.fontSize]}`}>
        {/* Letterhead */}
        <div className={`border-b-2 border-primary pb-4 mb-6 ${textAlign}`}>
          <h1 className="text-2xl font-bold text-primary">{settings?.clinicName ?? "Hospital"}</h1>
          {settings?.address && <p className="text-sm text-muted-foreground">{settings.address}</p>}
          {settings?.phone && <p className="text-sm text-muted-foreground">Tel: {settings.phone}</p>}
          {settings?.registrationNumber && <p className="text-xs text-muted-foreground">Reg: {settings.registrationNumber}</p>}
        </div>

        <div className={`mb-4 ${textAlign}`}>
          <p className="text-sm text-muted-foreground">Date: {prescription.visitDate}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 p-3 bg-muted/30 rounded">
          <div>
            <p className="text-xs text-muted-foreground">Patient Name</p>
            <p className="text-sm font-medium">{prescription.patientName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Doctor</p>
            <p className="text-sm font-medium">Dr. {prescription.doctorName}</p>
            {prescription.doctorRegistrationNumber && (
              <p className="text-xs text-muted-foreground">Reg: {prescription.doctorRegistrationNumber}</p>
            )}
          </div>
        </div>

        {fmt.showDiagnosis && prescription.diagnosis && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Diagnosis</p>
            <p className="text-sm">{prescription.diagnosis}</p>
          </div>
        )}

        {/* Drug list — table or narrative */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Rx — Medications</p>

          {fmt.drugStyle === "table" ? (
            <table className="w-full text-sm border border-border rounded">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium">#</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">Drug Name</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">Dosage</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">Frequency</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">Duration</th>
                  {fmt.showInstructions && <th className="px-3 py-2 text-left text-xs font-medium">Instructions</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">
                      {item.drugName}
                      {fmt.showGenericName && item.genericName && (
                        <span className="block text-xs text-muted-foreground">({item.genericName})</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{item.dosage}</td>
                    <td className="px-3 py-2">{item.frequency}</td>
                    <td className="px-3 py-2">{item.duration}</td>
                    {fmt.showInstructions && <td className="px-3 py-2 text-muted-foreground">{item.instructions ?? "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <ol className="space-y-2 list-none">
              {items.map((item, i) => (
                <li key={i} className="flex gap-3 items-start border-b border-border/50 pb-2 last:border-0">
                  <span className="font-bold text-primary min-w-[1.25rem]">{i + 1}.</span>
                  <div className="flex-1">
                    <span className="font-semibold">{item.drugName}</span>
                    {fmt.showGenericName && item.genericName && (
                      <span className="text-xs text-muted-foreground ml-1">({item.genericName})</span>
                    )}
                    <span className="text-muted-foreground"> — {item.dosage}, {item.frequency}, {item.duration}</span>
                    {fmt.showInstructions && item.instructions && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic">{item.instructions}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {fmt.showAdvice && prescription.advice && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Advice</p>
            <p className="text-sm">{prescription.advice}</p>
          </div>
        )}

        {fmt.showFollowUp && prescription.followUpDate && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Follow-up</p>
            <p className="text-sm">{prescription.followUpDate}</p>
          </div>
        )}

        <div className="mt-12 text-right">
          <div className="inline-block border-t border-foreground pt-2">
            <p className="text-sm font-medium">Dr. {prescription.doctorName}</p>
            {prescription.doctorRegistrationNumber && (
              <p className="text-xs text-muted-foreground">Reg. No: {prescription.doctorRegistrationNumber}</p>
            )}
            <p className="text-xs text-muted-foreground">Signature &amp; Stamp</p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          nav, aside, header { display: none !important; }
        }
      `}</style>
    </div>
  );
}
