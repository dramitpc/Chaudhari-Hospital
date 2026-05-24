import { useRoute, useLocation } from "wouter";
import { useGetCertificate, useGetClinicSettings, getGetCertificateQueryKey, getGetClinicSettingsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Printer } from "lucide-react";

const certTitles: Record<string, string> = {
  sick_leave: "Sick Leave Certificate",
  fitness: "Fitness Certificate",
  medical: "Medical Certificate",
  procedure: "Procedure Certificate",
  vaccination: "Vaccination Certificate",
};

export default function CertificateDetailPage() {
  const [, params] = useRoute("/certificates/:id");
  const id = params?.id ?? "";
  const [, setLocation] = useLocation();

  const { data: cert, isLoading } = useGetCertificate(id, {
    query: { enabled: !!id, queryKey: getGetCertificateQueryKey(id) }
  });
  const { data: settings } = useGetClinicSettings({ query: { queryKey: getGetClinicSettingsQueryKey() } });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!cert) return <div className="text-center py-8 text-muted-foreground">Certificate not found</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/certificates")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Button onClick={() => window.print()} data-testid="btn-print-certificate">
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
      </div>

      <div className="max-w-2xl mx-auto bg-white dark:bg-card rounded-lg border-2 border-border p-10 print:border-0">
        {/* Header */}
        <div className="text-center border-b-2 border-primary pb-6 mb-6">
          <h1 className="text-2xl font-bold text-primary">{settings?.clinicName ?? "Hospital"}</h1>
          {settings?.address && <p className="text-sm text-muted-foreground mt-1">{settings.address}</p>}
          {settings?.phone && <p className="text-sm text-muted-foreground">Tel: {settings.phone}</p>}
          {settings?.registrationNumber && <p className="text-xs text-muted-foreground">Reg: {settings.registrationNumber}</p>}
        </div>

        <div className="text-center mb-8">
          <h2 className="text-xl font-bold uppercase tracking-widest border-b-2 border-foreground inline-block pb-1">
            {certTitles[cert.type] ?? "Medical Certificate"}
          </h2>
          <p className="text-sm text-muted-foreground mt-2">Date: {cert.issuedDate}</p>
        </div>

        <div className="space-y-4 text-sm leading-relaxed">
          <p>
            This is to certify that <strong>{cert.patientName}</strong> has been examined and{" "}
            {cert.type === "sick_leave" ? (
              <>is found to be suffering from <strong>{cert.diagnosis ?? "illness"}</strong> and is advised rest from{" "}
              <strong>{cert.fromDate ?? cert.issuedDate}</strong> to <strong>{cert.toDate ?? cert.issuedDate}</strong>.</>
            ) : cert.type === "fitness" ? (
              <>is found medically fit for duty/activities as of the date of this certificate.</>
            ) : (
              <>{cert.content ?? <>has been issued this certificate as required.</>}</>
            )}
          </p>

          {cert.diagnosis && cert.type !== "sick_leave" && (
            <div className="mt-4">
              <p className="font-medium">Diagnosis: {cert.diagnosis}</p>
            </div>
          )}

          {cert.fromDate && cert.toDate && cert.type !== "sick_leave" && (
            <p>Period: <strong>{cert.fromDate}</strong> to <strong>{cert.toDate}</strong></p>
          )}

          {cert.content && cert.type !== "sick_leave" && cert.type !== "fitness" && (
            <div className="mt-4 p-4 bg-muted/20 rounded border border-border">
              <p>{cert.content}</p>
            </div>
          )}
        </div>

        {cert.qrCode && (
          <div className="mt-8 text-xs text-muted-foreground">
            <p>Verification Code: <code className="font-mono">{cert.qrCode}</code></p>
          </div>
        )}

        <div className="mt-16 grid grid-cols-2 gap-8">
          <div className="text-center">
            <div className="border-t border-foreground pt-2">
              <p className="text-sm font-medium">Dr. {cert.doctorName}</p>
              <p className="text-xs text-muted-foreground">Signature &amp; Stamp</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-foreground pt-2">
              <p className="text-sm font-medium">{cert.patientName}</p>
              <p className="text-xs text-muted-foreground">Patient Signature</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          nav, aside { display: none !important; }
        }
      `}</style>
    </div>
  );
}
