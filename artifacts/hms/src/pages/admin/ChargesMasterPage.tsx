import { useState } from "react";
import {
  useListChargeTypes, useCreateChargeType, useUpdateChargeType, useDeleteChargeType,
  getListChargeTypesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash } from "lucide-react";

const CATEGORIES = ["consultation", "procedure", "investigation", "other"] as const;
type Category = typeof CATEGORIES[number];

const categoryColors: Record<Category, string> = {
  consultation:  "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  procedure:     "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  investigation: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  other:         "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

type ChargeForm = { name: string; category: Category; unitPrice: string; taxPercent: string };
const emptyForm: ChargeForm = { name: "", category: "consultation", unitPrice: "", taxPercent: "0" };

export default function ChargesMasterPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ChargeForm>(emptyForm);
  const [filterCat, setFilterCat] = useState<string>("all");

  const { data: chargeTypes, isLoading } = useListChargeTypes({
    query: { queryKey: getListChargeTypesQueryKey() },
  });

  const createMutation = useCreateChargeType();
  const updateMutation = useUpdateChargeType();
  const deleteMutation = useDeleteChargeType();

  const charges = chargeTypes ?? [];
  const filtered = filterCat === "all" ? charges : charges.filter(c => c.category === filterCat);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (c: typeof charges[0]) => {
    setEditId(c.id);
    setForm({
      name: c.name,
      category: c.category as Category,
      unitPrice: String(c.unitPrice),
      taxPercent: String(c.taxPercent ?? 0),
    });
    setShowModal(true);
  };

  const handleSave = () => {
    const payload = {
      name: form.name.trim(),
      category: form.category,
      unitPrice: parseFloat(form.unitPrice) || 0,
      taxPercent: parseFloat(form.taxPercent) || 0,
    };

    if (editId) {
      updateMutation.mutate({ id: editId, data: payload }, {
        onSuccess: () => {
          toast({ title: "Charge updated" });
          queryClient.invalidateQueries({ queryKey: getListChargeTypesQueryKey() });
          setShowModal(false);
        },
        onError: () => toast({ title: "Error", description: "Failed to update charge", variant: "destructive" }),
      });
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: () => {
          toast({ title: "Charge added" });
          queryClient.invalidateQueries({ queryKey: getListChargeTypesQueryKey() });
          setShowModal(false);
        },
        onError: () => toast({ title: "Error", description: "Failed to add charge", variant: "destructive" }),
      });
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Remove "${name}" from the charges master?`)) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Charge removed" });
        queryClient.invalidateQueries({ queryKey: getListChargeTypesQueryKey() });
      },
      onError: () => toast({ title: "Error", description: "Failed to remove charge", variant: "destructive" }),
    });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Charges Master</h1>
          <p className="text-sm text-muted-foreground">{charges.length} charge types configured</p>
        </div>
        <Button onClick={openCreate} data-testid="btn-add-charge">
          <Plus className="mr-2 h-4 w-4" /> Add Charge
        </Button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {["all", ...CATEGORIES].map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors border ${
              filterCat === cat
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Unit Price (₹)</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Tax %</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Effective Price (₹)</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  {filterCat === "all" ? "No charge types configured yet" : `No charges in "${filterCat}" category`}
                </td>
              </tr>
            ) : (
              filtered.map(c => {
                const effective = c.unitPrice * (1 + (c.taxPercent ?? 0) / 100);
                return (
                  <tr key={c.id} className="border-b border-border hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${categoryColors[c.category as Category] ?? ""}`}>
                        {c.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">₹{c.unitPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{c.taxPercent ?? 0}%</td>
                    <td className="px-4 py-3 text-right font-mono font-medium">₹{effective.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(c.id, c.name)}
                        >
                          <Trash className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Summary bar */}
      {charges.length > 0 && (
        <div className="flex gap-6 text-sm text-muted-foreground">
          {CATEGORIES.map(cat => {
            const count = charges.filter(c => c.category === cat).length;
            return count > 0 ? (
              <span key={cat}>
                <span className="font-medium text-foreground">{count}</span> {cat}
              </span>
            ) : null;
          })}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Charge Type" : "Add Charge Type"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. OPD Consultation, X-Ray Chest PA"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Category <span className="text-destructive">*</span></Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as Category }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Unit Price (₹) <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unitPrice}
                  onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tax %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.taxPercent}
                  onChange={e => setForm(f => ({ ...f, taxPercent: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>

            {form.unitPrice && (
              <p className="text-sm text-muted-foreground">
                Effective price: ₹{(parseFloat(form.unitPrice || "0") * (1 + parseFloat(form.taxPercent || "0") / 100)).toFixed(2)}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || !form.unitPrice || isSaving}>
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
