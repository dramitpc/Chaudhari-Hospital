import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetInvoice, useRecordPayment,
  getGetInvoiceQueryKey, getListInvoicesQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invoice, isLoading } = useGetInvoice(id, {
    query: { enabled: !!id, queryKey: getGetInvoiceQueryKey(id) }
  });

  const paymentMutation = useRecordPayment();
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("cash");

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

  return (
    <div>
      <div className="flex items-center justify-between mb-4 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/billing")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-mono">{invoice.invoiceNumber}</h1>
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusColors[invoice.status] ?? ""}`}>
                {invoice.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{new Date(invoice.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

          <div className="rounded-lg border border-border bg-card p-5 space-y-2 text-sm">
            <h3 className="font-semibold">Invoice Details</h3>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice #</span>
              <span className="font-mono">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span>{new Date(invoice.createdAt).toLocaleDateString()}</span>
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

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          nav, aside { display: none !important; }
        }
      `}</style>
    </div>
  );
}
