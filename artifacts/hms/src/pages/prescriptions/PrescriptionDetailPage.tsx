import { useRoute, useLocation, useSearch } from "wouter";
import { useEffect } from "react";
import { useGetPrescription, useGetClinicSettings, getGetPrescriptionQueryKey, getGetClinicSettingsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Printer } from "lucide-react";

type PrescriptionItem = {
  drugName: string;
  genericName?: string | null;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string | null;
  quantity?: number | null;
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/prescriptions")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Button onClick={() => window.print()} data-testid="btn-print-prescription">
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>

      <div className="max-w-2xl mx-auto bg-white dark:bg-card rounded-lg border border-border p-8 print:border-0 print:shadow-none print:max-w-full">
        {/* Letterhead */}
        <div className="border-b-2 border-primary pb-4 mb-6 text-center">
          <h1 className="text-2xl font-bold text-primary">{settings?.clinicName ?? "Hospital"}</h1>
          {settings?.address && <p className="text-sm text-muted-foreground">{settings.address}</p>}
          {settings?.phone && <p className="text-sm text-muted-foreground">Tel: {settings.phone}</p>}
          {settings?.registrationNumber && <p className="text-xs text-muted-foreground">Reg: {settings.registrationNumber}</p>}
        </div>

        <div className="text-center mb-4">
          <h2 className="text-lg font-semibold uppercase tracking-wide">Prescription</h2>
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

        {prescription.diagnosis && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Diagnosis</p>
            <p className="text-sm">{prescription.diagnosis}</p>
          </div>
        )}

        <div className="mb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Rx — Medications</p>
          <table className="w-full text-sm border border-border rounded">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium">Drug Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium">Dosage</th>
                <th className="px-3 py-2 text-left text-xs font-medium">Frequency</th>
                <th className="px-3 py-2 text-left text-xs font-medium">Duration</th>
                <th className="px-3 py-2 text-left text-xs font-medium">Instructions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">
                    {item.drugName}
                    {item.genericName && <span className="block text-xs text-muted-foreground">({item.genericName})</span>}
                  </td>
                  <td className="px-3 py-2">{item.dosage}</td>
                  <td className="px-3 py-2">{item.frequency}</td>
                  <td className="px-3 py-2">{item.duration}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.instructions ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {prescription.advice && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Advice</p>
            <p className="text-sm">{prescription.advice}</p>
          </div>
        )}

        {prescription.followUpDate && (
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
          body { font-size: 12px; }
        }
      `}</style>
    </div>
  );
}
