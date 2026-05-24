import { useState } from "react";
import { useListDrugs, useCreateDrug, useUpdateDrug, useDeleteDrug, getListDrugsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

type DrugForm = { name: string; genericName: string; category: string; form: string; strength: string; defaultDosage: string; defaultFrequency: string; defaultDuration: string; defaultInstructions: string; };
const emptyForm: DrugForm = { name: "", genericName: "", category: "", form: "", strength: "", defaultDosage: "", defaultFrequency: "", defaultDuration: "", defaultInstructions: "" };

export default function DrugsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<DrugForm>(emptyForm);
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useListDrugs(
    { search: debouncedSearch || undefined, page, limit: 20 },
    { query: { queryKey: getListDrugsQueryKey({ search: debouncedSearch || undefined, page, limit: 20 }) } }
  );
  const createMutation = useCreateDrug();
  const updateMutation = useUpdateDrug();
  const deleteMutation = useDeleteDrug();

  const drugs = data?.data ?? [];

  const openCreate = () => { setEditId(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (drug: typeof drugs[0]) => {
    setEditId(drug.id);
    setForm({
      name: drug.name, genericName: drug.genericName ?? "", category: drug.category ?? "",
      form: drug.form ?? "", strength: drug.strength ?? "", defaultDosage: drug.defaultDosage ?? "",
      defaultFrequency: drug.defaultFrequency ?? "", defaultDuration: drug.defaultDuration ?? "",
      defaultInstructions: drug.defaultInstructions ?? "",
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (editId) {
      updateMutation.mutate({ id: editId, data: form }, {
        onSuccess: () => { toast({ title: "Drug updated" }); queryClient.invalidateQueries({ queryKey: getListDrugsQueryKey() }); setShowModal(false); },
      });
    } else {
      createMutation.mutate({ data: form }, {
        onSuccess: () => { toast({ title: "Drug added" }); queryClient.invalidateQueries({ queryKey: getListDrugsQueryKey() }); setShowModal(false); },
      });
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm("Remove this drug?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => { toast({ title: "Drug removed" }); queryClient.invalidateQueries({ queryKey: getListDrugsQueryKey() }); },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Drug Master Database</h1>
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} drugs</p>
        </div>
        <Button onClick={openCreate} data-testid="btn-add-drug">
          <Plus className="mr-2 h-4 w-4" /> Add Drug
        </Button>
      </div>

      <Input placeholder="Search drugs..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="max-w-sm" />

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Generic</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Form</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Default Dose</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Frequency</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-border">
                {Array.from({ length: 7 }).map((__, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}
              </tr>
            )) : drugs.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No drugs found</td></tr>
            ) : drugs.map(d => (
              <tr key={d.id} className="border-b border-border hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{d.genericName ?? "—"}</td>
                <td className="px-4 py-3">{d.category ?? "—"}</td>
                <td className="px-4 py-3">{d.form ?? "—"}</td>
                <td className="px-4 py-3">{d.defaultDosage ?? "—"}</td>
                <td className="px-4 py-3">{d.defaultFrequency ?? "—"}</td>
                <td className="px-4 py-3 flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(d)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(d.id)}>
                    <Trash className="h-3 w-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "Edit Drug" : "Add Drug"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(emptyForm) as Array<keyof DrugForm>).map(field => (
              <div key={field} className="space-y-1.5">
                <Label className="text-xs capitalize">{field.replace(/([A-Z])/g, " $1")}</Label>
                <Input value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name || createMutation.isPending || updateMutation.isPending}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
