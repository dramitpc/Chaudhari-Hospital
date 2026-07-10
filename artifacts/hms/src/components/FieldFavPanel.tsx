import { useState } from "react";
import { BookMarked, Star, Clock, X, Check } from "lucide-react";
import { fmtDateTime } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useSavedItems } from "@/lib/useSavedItems";

interface FieldFavPanelProps {
  lsKey: string;
  currentValue: string;
  onApply: (value: string) => void;
}

type FieldPayload = { value: string };

export function FieldFavPanel({ lsKey, currentValue, onApply }: FieldFavPanelProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [favName, setFavName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { favorites, recents, saveFavorite, deleteItem } = useSavedItems<FieldPayload>(`field:${lsKey}`);

  const toggle = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const applySelected = () => {
    const all = [...favorites, ...recents];
    const vals = [...selected]
      .map(id => all.find(e => e.id === id)?.payload.value ?? "")
      .filter(Boolean)
      .join("\n");
    if (!vals) return;
    const combined = currentValue.trim() ? `${currentValue.trim()}\n${vals}` : vals;
    onApply(combined);
    setIsOpen(false);
    setSelected(new Set());
    toast({ title: `${selected.size} item${selected.size > 1 ? "s" : ""} added to field` });
  };

  const saveFav = async () => {
    if (!favName.trim()) return;
    if (!currentValue.trim()) {
      toast({ title: "Nothing to save — field is empty", variant: "destructive" });
      return;
    }
    await saveFavorite(favName.trim(), { value: currentValue });
    setFavName("");
    toast({ title: "Saved to favourites" });
  };

  const deleteFav = (id: string) => { deleteItem(id); setSelected(p => { const n = new Set(p); n.delete(id); return n; }); };
  const deleteRecent = (id: string) => { deleteItem(id); setSelected(p => { const n = new Set(p); n.delete(id); return n; }); };
  const entryLabel = (e: { name: string; payload: FieldPayload }) =>
    e.name || (e.payload.value.slice(0, 60) + (e.payload.value.length > 60 ? "…" : ""));

  const total = favorites.length + recents.length;

  const EntryRow = ({ e, onDelete }: { e: { id: string; name: string; payload: FieldPayload }; onDelete: () => void }) => {
    const isSelected = selected.has(e.id);
    return (
      <div
        className={`flex items-center gap-2.5 rounded-md border px-3 py-2 cursor-pointer transition-colors text-xs
          ${isSelected ? "border-primary bg-primary/8 ring-1 ring-primary/30" : "border-border hover:bg-muted/50"}`}
        onClick={() => toggle(e.id)}
      >
        <div className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors
          ${isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
          {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
        </div>
        <span className="flex-1 min-w-0 break-words font-medium leading-snug">{entryLabel(e)}</span>
        <Button
          type="button" size="sm" variant="ghost"
          className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={ev => { ev.stopPropagation(); onDelete(); }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  };

  const RecentRow = ({ e, onDelete }: { e: { id: string; name: string; payload: FieldPayload; createdAt: string }; onDelete: () => void }) => {
    const isSelected = selected.has(e.id);
    return (
      <div
        className={`flex items-center gap-2.5 rounded-md border px-3 py-2 cursor-pointer transition-colors text-xs
          ${isSelected ? "border-primary bg-primary/8 ring-1 ring-primary/30" : "border-border hover:bg-muted/50"}`}
        onClick={() => toggle(e.id)}
      >
        <div className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors
          ${isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
          {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <span className="block break-words leading-snug">{entryLabel(e)}</span>
          <span className="text-muted-foreground text-[10px]">{fmtDateTime(new Date(e.createdAt).getTime())}</span>
        </div>
        <Button
          type="button" size="sm" variant="ghost"
          className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={ev => { ev.stopPropagation(); onDelete(); }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  };

  return (
    <>
      <Button
        type="button" size="sm" variant="ghost"
        className="h-6 gap-1 px-2 text-xs shrink-0"
        onClick={() => { setIsOpen(true); setFavName(""); setSelected(new Set()); }}
      >
        <BookMarked className="h-3 w-3" />
        {total > 0 ? `${favorites.length} fav · ${recents.length} recent` : "Favourites & Recent"}
      </Button>

      <Dialog open={isOpen} onOpenChange={open => { setIsOpen(open); if (!open) setSelected(new Set()); }}>
        <DialogContent className="max-w-lg w-full flex flex-col gap-0 p-0 max-h-[85vh]">
          <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <BookMarked className="h-4 w-4" />
              Favourites &amp; Recent
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[32rem] px-4 pb-2 space-y-3 min-h-0">
            {total === 0 && (
              <p className="text-muted-foreground text-xs text-center py-6">
                No entries yet — use the field and they will appear here automatically.
              </p>
            )}

            {favorites.length > 0 && (
              <div className="space-y-1">
                <p className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 py-1 sticky top-0 bg-background z-10">
                  <Star className="h-3.5 w-3.5" /> Favourites
                </p>
                {favorites.map(e => <EntryRow key={e.id} e={e} onDelete={() => deleteFav(e.id)} />)}
              </div>
            )}

            {recents.length > 0 && (
              <div className="space-y-1">
                <p className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 py-1 sticky top-0 bg-background z-10">
                  <Clock className="h-3.5 w-3.5" /> Recently Used
                </p>
                {recents.map(e => <RecentRow key={e.id} e={e} onDelete={() => deleteRecent(e.id)} />)}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-border px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground flex-1">
                {selected.size > 0 ? `${selected.size} selected` : "Click entries to select"}
              </span>
              <Button
                type="button" size="sm" className="h-7 px-3 text-xs"
                disabled={selected.size === 0}
                onClick={applySelected}
              >
                <Check className="h-3 w-3 mr-1" />
                Add to field{selected.size > 0 ? ` (${selected.size})` : ""}
              </Button>
            </div>

            <div className="flex gap-1.5">
              <Input
                className="h-7 text-xs flex-1"
                value={favName}
                onChange={e => setFavName(e.target.value)}
                placeholder="Name &amp; save current value as favourite…"
                onKeyDown={e => e.key === "Enter" && saveFav()}
              />
              <Button type="button" size="sm" className="h-7 px-3 text-xs" onClick={saveFav}>
                <Star className="h-3 w-3 mr-1" /> Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
