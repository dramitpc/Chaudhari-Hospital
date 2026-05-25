import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateInvoice, useListPatients, useListChargeTypes, getListPatientsQueryKey, getListChargeTypesQueryKey, getListInvoicesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X, ArrowLeft } from "lucide-react";

type LineItem = {
  description: string;
  chargeTypeId?: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  total: number;
};

const PAYMENT_MODES = ["cash", "card", "upi", "insurance"];

export default function NewInvoicePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const urlPatientId = new URLSearchParams(window.location.search).get("patientId");
  const [patientId, setPatientId] = useState(urlPatientId ?? "");
  const [patientSearch, setPatientSearch] = useState("");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0, discount: 0, tax: 0, total: 0 }
  ]);

  const { data: patients } = useListPatients(
    { search: patientSearch || undefined, limit: 50 },
    { query: { queryKey: getListPatientsQueryKey({ search: patientSearch || undefined, limit: 50 }) } }
  );
  const { data: chargeTypes } = useListChargeTypes({ query: { queryKey: getListChargeTypesQueryKey() } });
  const createMutation = useCreateInvoice();

  const updateItem = (i: number, field: keyof LineItem, value: string | number | null) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: value };
      if (field === "quantity" || field === "unitPrice" || field === "discount" || field === "tax") {
        updated.total = (Number(updated.quantity) * Number(updated.unitPrice)) - Number(updated.discount) + Number(updated.tax);
      }
      return updated;
    }));
  };

  const addItemFromCharge = (chargeTypeId: string) => {
    const ct = (chargeTypes ?? []).find(c => c.id === chargeTypeId);
    if (!ct) return;
    setItems(prev => [...prev, {
      chargeTypeId: ct.id,
      description: ct.name,
      quantity: 1,
      unitPrice: ct.unitPrice,
      discount: 0,
      tax: ct.taxPercent ? ct.unitPrice * ct.taxPercent / 100 : 0,
      total: ct.unitPrice,
    }]);
  };

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxTotal = items.reduce((s, i) => s + i.tax, 0);
  const total = subtotal - discount + taxTotal;

  const selectedPatient = (patients?.data ?? []).find(p => p.id === patientId);

  const handleSubmit = () => {
    if (!patientId) {
      toast({ title: "Select a patient", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      data: {
        patientId,
        discount,
        notes: notes || undefined,
        items: items.filter(i => i.description) as Parameters<typeof createMutation.mutate>[0]["data"]["items"],
      }
    }, {
      onSuccess: (inv) => {
        toast({ title: `Invoice ${inv.invoiceNumber} created` });
        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
        setLocation(`/billing/${inv.id}`);
      },
      onError: () => toast({ title: "Failed to create invoice", variant: "destructive" }),
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/billing")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">New Invoice</h1>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold border-b border-border pb-2">Patient</h2>
        {selectedPatient ? (
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div>
              <p className="font-medium">{selectedPatient.fullName}</p>
              <p className="text-sm text-muted-foreground">{selectedPatient.patientId} · {selectedPatient.phone ?? "No phone"}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPatientId("")}>Change</Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              placeholder="Search patients by name or ID..."
              value={patientSearch}
              onChange={e => setPatientSearch(e.target.value)}
              data-testid="input-patient-search"
            />
            {patientSearch && (
              <div className="border border-border rounded-lg max-h-48 overflow-y-auto">
                {(patients?.data ?? []).map(p => (
                  <button key={p.id} onClick={() => { setPatientId(p.id); setPatientSearch(""); }}
                    className="w-full text-left px-3 py-2 hover:bg-muted/40 text-sm">
                    <span className="font-medium">{p.fullName}</span>
                    <span className="text-muted-foreground ml-2 text-xs">{p.patientId}</span>
                  </button>
                ))}
                {(patients?.data ?? []).length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">No patients found</p>}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="font-semibold">Line Items</h2>
          <Select onValueChange={addItemFromCharge}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Add from charge types..." />
            </SelectTrigger>
            <SelectContent>
              {(chargeTypes ?? []).map(ct => (
                <SelectItem key={ct.id} value={ct.id}>{ct.name} — ₹{ct.unitPrice}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="text-left pb-2 pr-2 w-72">Description</th>
              <th className="text-right pb-2 pr-2 w-16">Qty</th>
              <th className="text-right pb-2 pr-2 w-24">Unit Price</th>
              <th className="text-right pb-2 pr-2 w-20">Discount</th>
              <th className="text-right pb-2 pr-2 w-20">Tax</th>
              <th className="text-right pb-2 w-24">Total</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-t border-border">
                <td className="py-2 pr-2">
                  <Input
                    className="h-8 text-xs"
                    value={item.description}
                    onChange={e => updateItem(i, "description", e.target.value)}
                    placeholder="Service description"
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input className="h-8 text-xs text-right" type="number" min="1" value={item.quantity}
                    onChange={e => updateItem(i, "quantity", parseInt(e.target.value) || 1)} />
                </td>
                <td className="py-2 pr-2">
                  <Input className="h-8 text-xs text-right" type="number" min="0" step="0.01" value={item.unitPrice}
                    onChange={e => updateItem(i, "unitPrice", parseFloat(e.target.value) || 0)} />
                </td>
                <td className="py-2 pr-2">
                  <Input className="h-8 text-xs text-right" type="number" min="0" step="0.01" value={item.discount}
                    onChange={e => updateItem(i, "discount", parseFloat(e.target.value) || 0)} />
                </td>
                <td className="py-2 pr-2">
                  <Input className="h-8 text-xs text-right" type="number" min="0" step="0.01" value={item.tax}
                    onChange={e => updateItem(i, "tax", parseFloat(e.target.value) || 0)} />
                </td>
                <td className="py-2 text-right font-medium">₹{item.total.toFixed(2)}</td>
                <td className="py-2">
                  <Button size="icon" variant="ghost" className="h-7 w-7"
                    onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))}>
                    <X className="h-3 w-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <Button variant="outline" size="sm" onClick={() => setItems(prev => [
          ...prev, { description: "", quantity: 1, unitPrice: 0, discount: 0, tax: 0, total: 0 }
        ])}>
          <Plus className="h-3 w-3 mr-1" /> Add Row
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold border-b border-border pb-2">Summary</h2>
        <div className="max-w-xs ml-auto space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm items-center">
            <span className="text-muted-foreground">Discount</span>
            <Input type="number" min="0" step="0.01" value={discount}
              onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
              className="w-28 h-7 text-right text-xs" />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax</span>
            <span>₹{taxTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold border-t border-border pt-2">
            <span>Total</span>
            <span className="text-lg">₹{total.toFixed(2)}</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Invoice notes..." />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => setLocation("/billing")}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={createMutation.isPending} data-testid="btn-create-invoice">
          {createMutation.isPending ? "Creating..." : "Create Invoice"}
        </Button>
      </div>
    </div>
  );
}
