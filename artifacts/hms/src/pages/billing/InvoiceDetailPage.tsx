import { useState } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import { fmtDate } from "@/lib/dateUtils";
import {
  useGetInvoice, useRecordPayment, useUpdateInvoice, useGetPatient, useGetClinicSettings,
  getGetInvoiceQueryKey, getListInvoicesQueryKey, getGetPatientQueryKey, getGetClinicSettingsQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Printer, Share2, XCircle } from "lucide-react";
import ShareDialog from "@/components/ShareDialog";
import { useAuth } from "@/contexts/AuthContext";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  pending: "bg-amber-100 text-amber-800",
  paid: "bg-green-100 text-green-800",
  partial: "bg-blue-100 text-blue-800",
  cancelled: "bg-red-100 text-red-800",
};

type InvoiceItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  tax?: number;
  total: number;
};

export default function InvoiceDetailPage() {
  const [, params] = useRoute("/billing/:id");
  const id = params?.id ?? "";
  const [, setLocation] = useLocation();
  const search = useSearch();
  const fromBilling = new URLSearchParams(search).get("from") === "billing";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invoice, isLoading } = useGetInvoice(id, {
    query: { enabled: !!id, queryKey: getGetInvoiceQueryKey(id) }
  });
  const { data: settings } = useGetClinicSettings({ query: { queryKey: getGetClinicSettingsQueryKey() } });
  const patientId = invoice?.patientId ?? "";
  const { data: patient } = useGetPatient(patientId, {
    query: { enabled: !!patientId, queryKey: getGetPatientQueryKey(patientId) }
  });

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const paymentMutation = useRecordPayment();
  const cancelMutation = useUpdateInvoice();
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("cash");
  const [showShare, setShowShare] = useState(false);

  const handleCancel = () => {
    if (!confirm("Cancel this invoice? This cannot be undone.")) return;
    cancelMutation.mutate({ id, data: { status: "cancelled" } }, {
      onSuccess: () => {
        toast({ title: "Invoice cancelled" });
        queryClient.invalidateQueries({ queryKey: getGetInvoiceQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      },
      onError: () => toast({ title: "Failed to cancel invoice", variant: "destructive" }),
    });
  };

  const handlePayment = () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    paymentMutation.mutate({ id, data: { amount, paymentMode: payMode as "cash" | "card" | "upi" | "insurance" } }, {
      onSuccess: () => {
        toast({ title: "Payment recorded" });
        queryClient.invalidateQueries({ queryKey: getGetInvoiceQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
        setPayAmount("");
      },
      onError: () => toast({ title: "Failed to record payment", variant: "destructive" }),
    });
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!invoice) return <div className="text-center py-8 text-muted-foreground">Invoice not found</div>;

  const items = (invoice.items ?? []) as InvoiceItem[];

  const invoiceShareMessage = (() => {
    const clinic = settings?.clinicName ?? "ClinicOS";
    const lines: string[] = [];
    lines.push(`*Invoice — ${clinic}*`);
    if (settings?.phone) lines.push(settings.phone);
    lines.push("");
    lines.push(`Invoice No: ${invoice.invoiceNumber}`);
    lines.push(`Date: ${fmtDate(invoice.createdAt)}`);
    lines.push(`Patient: ${invoice.patientName}`);
    if (invoice.doctorName) lines.push(`Doctor: Dr. ${invoice.doctorName}`);
    lines.push("");
    lines.push("*Items:*");
    items.forEach(item => {
      lines.push(`• ${item.description} — Qty ${item.quantity} × ₹${item.unitPrice.toFixed(2)} = ₹${item.total.toFixed(2)}`);
    });
    lines.push("");
    lines.push(`Subtotal: ₹${invoice.subtotal.toFixed(2)}`);
    if ((invoice.discount ?? 0) > 0) lines.push(`Discount: -₹${(invoice.discount ?? 0).toFixed(2)}`);
    if ((invoice.tax ?? 0) > 0) lines.push(`Tax: ₹${(invoice.tax ?? 0).toFixed(2)}`);
    lines.push(`*Total: ₹${invoice.total.toFixed(2)}*`);
    lines.push(`Paid: ₹${(invoice.amountPaid ?? 0).toFixed(2)}`);
    if ((invoice.balance ?? 0) > 0) lines.push(`*Balance Due: ₹${(invoice.balance ?? 0).toFixed(2)}*`);
    lines.push("");
    lines.push(`Thank you for visiting ${clinic}!`);
    return lines.join("\n");
  })();

  return (
    <div>
      <div className="flex items-center justify-between mb-4 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => fromBilling ? setLocation("/billing") : invoice.consultationId ? setLocation(`/consultations/${invoice.consultationId}?tab=invoices`) : setLocation(`/patients/${invoice.patientId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-mono">{invoice.invoiceNumber}</h1>
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusColors[invoice.status] ?? ""}`}>
                {invoice.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{fmtDate(invoice.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowShare(true)}>
            <Share2 className="mr-1.5 h-4 w-4" /> Share
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-xs text-muted-foreground">Patient</p>
                <p className="font-medium">{invoice.patientName}</p>
              </div>
              {invoice.doctorName && (
                <div>
                  <p className="text-xs text-muted-foreground">Doctor</p>
                  <p className="font-medium">{invoice.doctorName}</p>
                </div>
              )}
            </div>

            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left py-2 pr-4 font-medium">Description</th>
                  <th className="text-right py-2 pr-4 font-medium">Qty</th>
                  <th className="text-right py-2 pr-4 font-medium">Unit Price</th>
                  <th className="text-right py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="py-3 pr-4">{item.description}</td>
                    <td className="py-3 pr-4 text-right">{item.quantity}</td>
                    <td className="py-3 pr-4 text-right">₹{item.unitPrice.toFixed(2)}</td>
                    <td className="py-3 text-right">₹{item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex justify-end">
              <div className="w-56 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{invoice.subtotal.toFixed(2)}</span>
                </div>
                {(invoice.discount ?? 0) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-₹{(invoice.discount ?? 0).toFixed(2)}</span>
                  </div>
                )}
                {(invoice.tax ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>₹{(invoice.tax ?? 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t border-border pt-1">
                  <span>Total</span>
                  <span>₹{invoice.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Paid</span>
                  <span>₹{(invoice.amountPaid ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-amber-600">
                  <span>Balance</span>
                  <span>₹{(invoice.balance ?? 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {invoice.status !== "paid" && invoice.status !== "cancelled" && (
            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              <h3 className="font-semibold">Record Payment</h3>
              <div className="space-y-1.5">
                <Label className="text-xs">Amount (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  placeholder={`Max: ₹${(invoice.balance ?? 0).toFixed(2)}`}
                  data-testid="input-payment-amount"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Payment Mode</Label>
                <div className="grid grid-cols-2 gap-2">
                  {["cash", "card", "upi", "insurance"].map(mode => (
                    <button
                      key={mode}
                      onClick={() => setPayMode(mode)}
                      className={`py-1.5 rounded border text-xs font-medium capitalize transition-colors ${payMode === mode ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                      data-testid={`payment-mode-${mode}`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
              <Button className="w-full" onClick={handlePayment} disabled={paymentMutation.isPending} data-testid="btn-record-payment">
                {paymentMutation.isPending ? "Recording..." : "Record Payment"}
              </Button>
            </div>
          )}

          {isAdmin && invoice.status !== "cancelled" && invoice.status !== "refunded" && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
              <h3 className="font-semibold text-destructive mb-3">Admin Actions</h3>
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
              >
                <XCircle className="mr-2 h-4 w-4" />
                {cancelMutation.isPending ? "Cancelling..." : "Cancel Invoice"}
              </Button>
            </div>
          )}

          <div className="rounded-lg border border-border bg-card p-5 space-y-2 text-sm">
            <h3 className="font-semibold">Invoice Details</h3>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice #</span>
              <span className="font-mono">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span>{fmtDate(invoice.createdAt)}</span>
            </div>
            {invoice.paymentMode && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Mode</span>
                <span className="capitalize">{invoice.paymentMode}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Print-only half-A4 landscape invoice ── */}
      {/* Page = 297mm × 105mm (half A4 height in landscape) with 8mm margins      */}
      {/* Usable container = 281mm wide × 89mm tall                                 */}
      {/* Two invoices tile on one A4 sheet — flip the paper for the second copy    */}
      <div className="hidden print:block" style={{
        width: "281mm", height: "89mm", overflow: "hidden",
        display: "flex", flexDirection: "column",
        fontFamily: "Arial, Helvetica, sans-serif", fontSize: "8pt", color: "#222", boxSizing: "border-box",
      }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2pt solid #1e3a5f", paddingBottom: "2.5mm", marginBottom: "2.5mm" }}>
          <div>
            <div style={{ fontSize: "13pt", fontWeight: 800, color: "#1e3a5f", lineHeight: 1.1 }}>
              {settings?.clinicName ?? "ClinicOS"}
            </div>
            {settings?.address && <div style={{ fontSize: "7pt", color: "#555", marginTop: "1mm" }}>{settings.address}</div>}
            <div style={{ fontSize: "7pt", color: "#555", marginTop: "0.8mm", display: "flex", gap: "5mm" }}>
              {settings?.phone && <span>✆ {settings.phone}</span>}
              {settings?.email && <span>✉ {settings.email}</span>}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "6mm" }}>
            <div style={{ fontSize: "15pt", fontWeight: 700, color: "#1e3a5f", letterSpacing: "2pt", textTransform: "uppercase" }}>Invoice</div>
            <div style={{ fontSize: "7.5pt", fontWeight: 600, color: "#444", fontFamily: "monospace", marginTop: "0.8mm" }}>{invoice.invoiceNumber}</div>
            <div style={{ fontSize: "7pt", color: "#666", marginTop: "0.6mm" }}>Date: {fmtDate(invoice.createdAt)}</div>
            <div style={{ marginTop: "1.2mm" }}>
              <span style={{
                fontSize: "6.5pt", fontWeight: 700, padding: "1pt 5pt", borderRadius: "2pt", textTransform: "uppercase",
                background: invoice.status === "paid" ? "#dcfce7" : invoice.status === "partial" ? "#dbeafe" : invoice.status === "pending" ? "#fef3c7" : "#fee2e2",
                color: invoice.status === "paid" ? "#166534" : invoice.status === "partial" ? "#1e40af" : invoice.status === "pending" ? "#92400e" : "#991b1b",
              }}>{invoice.status.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* ── Info cards ── */}
        <div style={{ display: "flex", gap: "3mm", marginBottom: "2.5mm" }}>
          <div style={{ flex: 1, background: "#f8fafc", border: "0.5pt solid #e2e8f0", borderRadius: "3pt", padding: "1.5mm 2.5mm" }}>
            <div style={{ fontSize: "5.5pt", fontWeight: 700, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: "0.5pt", marginBottom: "0.8mm" }}>Bill To</div>
            <div style={{ fontSize: "8.5pt", fontWeight: 700, color: "#111" }}>{invoice.patientName}</div>
            {patient?.dateOfBirth && <div style={{ fontSize: "7pt", color: "#555", marginTop: "0.4mm" }}>DOB: {fmtDate(patient.dateOfBirth)}</div>}
            {patient?.phone && <div style={{ fontSize: "7pt", color: "#555" }}>✆ {patient.phone}</div>}
          </div>
          {invoice.doctorName && (
            <div style={{ flex: 1, background: "#f8fafc", border: "0.5pt solid #e2e8f0", borderRadius: "3pt", padding: "1.5mm 2.5mm" }}>
              <div style={{ fontSize: "5.5pt", fontWeight: 700, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: "0.5pt", marginBottom: "0.8mm" }}>Consulting Doctor</div>
              <div style={{ fontSize: "8.5pt", fontWeight: 700, color: "#111" }}>Dr. {invoice.doctorName}</div>
            </div>
          )}
          <div style={{ flex: 1, background: "#f8fafc", border: "0.5pt solid #e2e8f0", borderRadius: "3pt", padding: "1.5mm 2.5mm" }}>
            <div style={{ fontSize: "5.5pt", fontWeight: 700, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: "0.5pt", marginBottom: "0.8mm" }}>Payment</div>
            {invoice.paymentMode && <div style={{ fontSize: "8pt", fontWeight: 700, color: "#111", textTransform: "capitalize" }}>{invoice.paymentMode}</div>}
            <div style={{ fontSize: "7pt", color: "#16a34a", fontWeight: 600 }}>Paid: ₹{(invoice.amountPaid ?? 0).toFixed(2)}</div>
            {(invoice.balance ?? 0) > 0 && <div style={{ fontSize: "7pt", color: "#b45309", fontWeight: 600 }}>Balance: ₹{(invoice.balance ?? 0).toFixed(2)}</div>}
          </div>
        </div>

        {/* ── Items table + Totals side by side (landscape space advantage) ── */}
        <div style={{ display: "flex", gap: "4mm", flex: 1, minHeight: 0 }}>
          {/* Items table */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "7.5pt" }}>
              <thead>
                <tr style={{ background: "#1e3a5f", color: "#fff" }}>
                  <th style={{ padding: "1.2mm 1.5mm", textAlign: "left", fontWeight: 600, width: "5mm" }}>#</th>
                  <th style={{ padding: "1.2mm 1.5mm", textAlign: "left", fontWeight: 600 }}>Description</th>
                  <th style={{ padding: "1.2mm 1.5mm", textAlign: "right", fontWeight: 600, width: "9mm" }}>Qty</th>
                  <th style={{ padding: "1.2mm 1.5mm", textAlign: "right", fontWeight: 600, width: "20mm" }}>Unit Price</th>
                  {items.some(it => (it.discount ?? 0) > 0) && <th style={{ padding: "1.2mm 1.5mm", textAlign: "right", fontWeight: 600, width: "16mm" }}>Disc (₹)</th>}
                  {items.some(it => (it.tax ?? 0) > 0) && <th style={{ padding: "1.2mm 1.5mm", textAlign: "right", fontWeight: 600, width: "15mm" }}>Tax (₹)</th>}
                  <th style={{ padding: "1.2mm 1.5mm", textAlign: "right", fontWeight: 600, width: "20mm" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "0.5pt solid #e2e8f0" }}>
                    <td style={{ padding: "1.2mm 1.5mm", color: "#999" }}>{idx + 1}</td>
                    <td style={{ padding: "1.2mm 1.5mm", fontWeight: 500 }}>{item.description}</td>
                    <td style={{ padding: "1.2mm 1.5mm", textAlign: "right" }}>{item.quantity}</td>
                    <td style={{ padding: "1.2mm 1.5mm", textAlign: "right" }}>₹{item.unitPrice.toFixed(2)}</td>
                    {items.some(it => (it.discount ?? 0) > 0) && <td style={{ padding: "1.2mm 1.5mm", textAlign: "right", color: "#16a34a" }}>{(item.discount ?? 0) > 0 ? `₹${(item.discount ?? 0).toFixed(2)}` : "—"}</td>}
                    {items.some(it => (it.tax ?? 0) > 0) && <td style={{ padding: "1.2mm 1.5mm", textAlign: "right" }}>{(item.tax ?? 0) > 0 ? `₹${(item.tax ?? 0).toFixed(2)}` : "—"}</td>}
                    <td style={{ padding: "1.2mm 1.5mm", textAlign: "right", fontWeight: 600 }}>₹{item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals panel */}
          <div style={{ flexShrink: 0, width: "52mm", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div style={{ fontSize: "7.5pt", borderLeft: "2pt solid #e2e8f0", paddingLeft: "3mm" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.7mm 0", borderBottom: "0.5pt solid #e2e8f0" }}>
                <span style={{ color: "#555" }}>Subtotal</span><span>₹{invoice.subtotal.toFixed(2)}</span>
              </div>
              {(invoice.discount ?? 0) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "0.7mm 0", borderBottom: "0.5pt solid #e2e8f0", color: "#16a34a" }}>
                  <span>Discount</span><span>-₹{(invoice.discount ?? 0).toFixed(2)}</span>
                </div>
              )}
              {(invoice.tax ?? 0) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "0.7mm 0", borderBottom: "0.5pt solid #e2e8f0" }}>
                  <span style={{ color: "#555" }}>Tax</span><span>₹{(invoice.tax ?? 0).toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "1mm 0", borderTop: "1pt solid #1e3a5f", borderBottom: "2pt solid #1e3a5f", fontWeight: 700, fontSize: "9pt", color: "#1e3a5f" }}>
                <span>TOTAL</span><span>₹{invoice.total.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.7mm 0", borderBottom: "0.5pt solid #e2e8f0", color: "#16a34a", fontWeight: 600 }}>
                <span>Paid</span><span>₹{(invoice.amountPaid ?? 0).toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.7mm 0", fontWeight: 600, color: (invoice.balance ?? 0) > 0 ? "#b45309" : "#16a34a" }}>
                <span>Balance Due</span><span>₹{(invoice.balance ?? 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ borderTop: "0.5pt solid #e2e8f0", paddingTop: "1.5mm", marginTop: "2mm", fontSize: "6.5pt", color: "#999", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Thank you for choosing <strong style={{ color: "#1e3a5f" }}>{settings?.clinicName ?? "ClinicOS"}</strong>. We wish you good health.</span>
          <span style={{ fontFamily: "monospace", color: "#ccc", marginLeft: "4mm", flexShrink: 0 }}>{invoice.invoiceNumber}</span>
        </div>
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          nav, aside, header { display: none !important; }
          body { margin: 0; }
          @page { size: 297mm 105mm; margin: 8mm; }
        }
        @media screen {
          .hidden.print\\:block { display: none !important; }
        }
      `}</style>

      <ShareDialog
        open={showShare}
        onOpenChange={setShowShare}
        patientName={invoice.patientName ?? "Patient"}
        patientPhone={patient?.phone}
        patientEmail={patient?.email}
        message={invoiceShareMessage}
        emailSubject={`Invoice ${invoice.invoiceNumber} — ${settings?.clinicName ?? "ClinicOS"}`}
      />
    </div>
  );
}
