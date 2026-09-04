import { useState } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import { fmtDate } from "@/lib/dateUtils";
import {
  useGetInvoice, useRecordPayment, useUpdateInvoice, useGetPatient, useGetClinicSettings,
  useListInvoicePayments,
  getGetInvoiceQueryKey, getListInvoicesQueryKey, getGetPatientQueryKey, getGetClinicSettingsQueryKey,
  getListInvoicePaymentsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Printer, Share2, XCircle } from "lucide-react";
import ShareDialog from "@/components/ShareDialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  createReceiptPdf,
  downloadPdf,
  pdfToFile,
  receiptPdfFileName,
} from "@/lib/pdfDocuments";

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
  const searchParams = new URLSearchParams(search);
  const fromBilling = searchParams.get("from") === "billing";
  const fromConsultation = searchParams.get("from") === "consultation";
  const fromConsultationId = searchParams.get("cid") ?? "";
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

  const { data: payments } = useListInvoicePayments(id, {
    query: { enabled: !!id, queryKey: getListInvoicePaymentsQueryKey(id) }
  });

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
        queryClient.invalidateQueries({ queryKey: getListInvoicePaymentsQueryKey(id) });
        setPayAmount("");
      },
      onError: () => toast({ title: "Failed to record payment", variant: "destructive" }),
    });
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!invoice) return <div className="text-center py-8 text-muted-foreground">Invoice not found</div>;

  const items = (invoice.items ?? []) as InvoiceItem[];
  const makeReceiptPdf = () => createReceiptPdf({ invoice, patient, payments, settings });
  const handlePrintPdf = () => window.print();
  const handleDownloadPdf = async () => downloadPdf(await makeReceiptPdf(), receiptPdfFileName(invoice));
  const handleCreatePdfFile = async () => pdfToFile(await makeReceiptPdf(), receiptPdfFileName(invoice));

  const invoiceShareMessage = (() => {
    const clinic = settings?.clinicName ?? "ClinicOS";
    const lines: string[] = [];
    lines.push(`*Invoice — ${clinic}*`);
    if (settings?.phone) lines.push(settings.phone);
    lines.push("");
    lines.push(`Invoice No: ${invoice.invoiceNumber}`);
    lines.push(`Date: ${fmtDate(invoice.createdAt)}`);
    lines.push(`Patient: ${invoice.patientName}`);
    if (invoice.doctorName) lines.push(`Doctor: ${invoice.doctorName}`);
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
          <Button variant="ghost" size="icon" onClick={() => {
            if (fromConsultation && fromConsultationId) {
              setLocation(`/consultations/${fromConsultationId}?tab=invoices`);
            } else if (fromBilling) {
              setLocation("/billing");
            } else if (invoice.consultationId) {
              setLocation(`/consultations/${invoice.consultationId}?tab=invoices`);
            } else {
              setLocation(`/patients/${invoice.patientId}`);
            }
          }}>
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
          <Button variant="outline" onClick={handlePrintPdf}>
            <Printer className="mr-2 h-4 w-4" /> Print PDF
          </Button>
          <Button variant="outline" onClick={handleDownloadPdf}>
            <Download className="mr-2 h-4 w-4" /> Save PDF
          </Button>
        </div>
      </div>

      <div className="invoice-print-content grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="invoice-print-main lg:col-span-2 space-y-4">
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

        <div className="invoice-screen-actions space-y-4">
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
              <span className="text-muted-foreground">Invoice Date</span>
              <span>{fmtDate(invoice.createdAt)}</span>
            </div>
          </div>

          {payments && payments.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-5 space-y-3 text-sm">
              <h3 className="font-semibold">Payment History</h3>
              <div className="space-y-2">
                {payments.map((p, idx) => (
                  <div key={p.id} className="flex items-start justify-between gap-2 py-2 border-b border-border last:border-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">#{idx + 1} — {fmtDate(p.paidAt)}</span>
                      <span className="capitalize text-xs font-medium text-muted-foreground">{p.paymentMode}</span>
                      {p.notes && <span className="text-xs text-muted-foreground italic">{p.notes}</span>}
                    </div>
                    <span className="font-semibold text-green-700 whitespace-nowrap">₹{p.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between pt-1 font-semibold border-t border-border">
                <span>Total Collected</span>
                <span className="text-green-700">₹{(invoice.amountPaid ?? 0).toFixed(2)}</span>
              </div>
              {(invoice.balance ?? 0) > 0 && (
                <div className="flex justify-between font-semibold text-amber-600">
                  <span>Balance Due</span>
                  <span>₹{(invoice.balance ?? 0).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="invoice-sept3-print">
        <div className="invoice-sept3-header">
          <div>
            <div className="invoice-sept3-clinic">{settings?.clinicName ?? "ClinicOS"}</div>
            {settings?.address && <div className="invoice-sept3-muted">{settings.address}</div>}
            <div className="invoice-sept3-contact">
              {settings?.phone && <span>Tel: {settings.phone}</span>}
              {settings?.email && <span>{settings.email}</span>}
            </div>
          </div>
          <div className="invoice-sept3-title-block">
            <div className="invoice-sept3-title">INVOICE</div>
            <div className="invoice-sept3-number">{invoice.invoiceNumber}</div>
            <div className="invoice-sept3-muted">Date: {fmtDate(invoice.createdAt)}</div>
            <span className={`invoice-sept3-status invoice-sept3-status-${invoice.status}`}>
              {invoice.status.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="invoice-sept3-cards">
          <div className="invoice-sept3-card">
            <div className="invoice-sept3-label">Bill To</div>
            <div className="invoice-sept3-card-name">{invoice.patientName}</div>
            {patient?.dateOfBirth && <div className="invoice-sept3-muted">DOB: {fmtDate(patient.dateOfBirth)}</div>}
            {patient?.phone && <div className="invoice-sept3-muted">Tel: {patient.phone}</div>}
          </div>
          {invoice.doctorName && (
            <div className="invoice-sept3-card">
              <div className="invoice-sept3-label">Consulting Doctor</div>
              <div className="invoice-sept3-card-name">{invoice.doctorName}</div>
            </div>
          )}
        </div>

        <table className="invoice-sept3-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th className="invoice-sept3-right">Qty</th>
              <th className="invoice-sept3-right">Rate</th>
              <th className="invoice-sept3-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{item.description}</td>
                <td className="invoice-sept3-right">{item.quantity}</td>
                <td className="invoice-sept3-right">₹{item.unitPrice.toFixed(2)}</td>
                <td className="invoice-sept3-right">₹{item.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="invoice-sept3-summary">
          <div className="invoice-sept3-payments">
            <div className="invoice-sept3-label">Payment Details</div>
            {payments && payments.length > 0 ? (
              <>
                {payments.map((payment, index) => (
                  <div key={payment.id} className="invoice-sept3-payment-row">
                    <span>#{index + 1} · {fmtDate(payment.paidAt)} · {payment.paymentMode}</span>
                    <strong>₹{payment.amount.toFixed(2)}</strong>
                  </div>
                ))}
                <div className="invoice-sept3-payment-total">
                  <span>Total Paid</span>
                  <strong>₹{(invoice.amountPaid ?? 0).toFixed(2)}</strong>
                </div>
              </>
            ) : (
              <div className="invoice-sept3-muted">{invoice.paymentMode || "No payment recorded"}</div>
            )}
            {(invoice.balance ?? 0) > 0 && (
              <div className="invoice-sept3-balance">Balance: ₹{(invoice.balance ?? 0).toFixed(2)}</div>
            )}
          </div>

          <div className="invoice-sept3-totals">
            <div><span>Subtotal</span><span>₹{invoice.subtotal.toFixed(2)}</span></div>
            {(invoice.discount ?? 0) > 0 && <div className="invoice-sept3-green"><span>Discount</span><span>-₹{(invoice.discount ?? 0).toFixed(2)}</span></div>}
            {(invoice.tax ?? 0) > 0 && <div><span>Tax</span><span>₹{(invoice.tax ?? 0).toFixed(2)}</span></div>}
            <div className="invoice-sept3-grand-total"><span>TOTAL</span><span>₹{invoice.total.toFixed(2)}</span></div>
            <div className="invoice-sept3-green"><span>Paid</span><span>₹{(invoice.amountPaid ?? 0).toFixed(2)}</span></div>
            <div className={(invoice.balance ?? 0) > 0 ? "invoice-sept3-balance" : "invoice-sept3-green"}>
              <span>Balance Due</span><span>₹{(invoice.balance ?? 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="invoice-sept3-footer">
          <span>Thank you for choosing <strong>{settings?.clinicName ?? "ClinicOS"}</strong>. We wish you good health.</span>
          <span>{invoice.invoiceNumber}</span>
        </div>
      </div>

      <style>{`
        .invoice-sept3-print { display: none; }
        @media print {
          @page { size: A4; margin: 12mm; }
          .invoice-print-content { display: none !important; }
          .invoice-sept3-print {
            display: block !important;
            width: 100%;
            height: 136mm;
            overflow: hidden;
            color: #111827;
            font-family: Arial, sans-serif;
            font-size: 10px;
          }
          .invoice-sept3-header {
            border-bottom: 2.5px solid #1e3a5f;
            padding-bottom: 8px;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .invoice-sept3-clinic { font-size: 22px; font-weight: 800; color: #1e3a5f; line-height: 1.1; }
          .invoice-sept3-muted { color: #666; margin-top: 2px; }
          .invoice-sept3-contact { color: #555; display: flex; gap: 14px; margin-top: 2px; }
          .invoice-sept3-title-block { text-align: right; }
          .invoice-sept3-title { font-size: 26px; font-weight: 700; color: #1e3a5f; letter-spacing: 2px; }
          .invoice-sept3-number { font: 600 12px monospace; color: #444; margin-top: 2px; }
          .invoice-sept3-status { display: inline-block; margin-top: 5px; padding: 3px 9px; border-radius: 4px; font-weight: 700; font-size: 9px; letter-spacing: .5px; }
          .invoice-sept3-status-paid { background: #dcfce7; color: #166534; }
          .invoice-sept3-status-partial { background: #dbeafe; color: #1e40af; }
          .invoice-sept3-status-pending, .invoice-sept3-status-draft { background: #fef3c7; color: #92400e; }
          .invoice-sept3-status-cancelled { background: #fee2e2; color: #991b1b; }
          .invoice-sept3-cards { display: flex; gap: 12px; margin-bottom: 10px; }
          .invoice-sept3-card { flex: 1; min-height: 42px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 7px 10px; }
          .invoice-sept3-label { color: #1e3a5f; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; margin-bottom: 3px; }
          .invoice-sept3-card-name { font-size: 12px; font-weight: 600; }
          .invoice-sept3-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
          .invoice-sept3-table th { background: #1e3a5f; color: white; padding: 5px 7px; text-align: left; font-size: 9px; }
          .invoice-sept3-table td { border-bottom: 1px solid #e2e8f0; padding: 5px 7px; }
          .invoice-sept3-table tbody tr:nth-child(even) { background: #f8fafc; }
          .invoice-sept3-right { text-align: right !important; }
          .invoice-sept3-summary { display: flex; justify-content: space-between; gap: 18px; margin-bottom: 8px; }
          .invoice-sept3-payments { flex: 1; }
          .invoice-sept3-payment-row, .invoice-sept3-payment-total, .invoice-sept3-totals > div { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; }
          .invoice-sept3-payment-total { border-top: 1px solid #cbd5e1; margin-top: 3px; color: #166534; font-weight: 700; }
          .invoice-sept3-totals { width: 220px; }
          .invoice-sept3-totals > div { border-bottom: 1px solid #e2e8f0; }
          .invoice-sept3-grand-total { border-bottom: 2px solid #1e3a5f !important; color: #1e3a5f; font-size: 13px; font-weight: 700; }
          .invoice-sept3-green { color: #16a34a; font-weight: 600; }
          .invoice-sept3-balance { color: #92400e; font-weight: 600; }
          .invoice-sept3-footer { border-top: 1px solid #e2e8f0; padding-top: 7px; color: #888; display: flex; justify-content: space-between; }
          .invoice-sept3-footer strong { color: #1e3a5f; }
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
        onDownloadPdf={handleDownloadPdf}
        onCreatePdfFile={handleCreatePdfFile}
        pdfFileName={receiptPdfFileName(invoice)}
      />
    </div>
  );
}
