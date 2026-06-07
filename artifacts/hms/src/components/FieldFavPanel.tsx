import { useState } from "react";
import { BookMarked, Star, Clock, X, Check } from "lucide-react";
import { fmtDateTime } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import type { FavEntry } from "@/lib/favUtils";

interface FieldFavPanelProps {
  lsKey: string;
  currentValue: string;
  onApply: (value: string) => void;
}

export function FieldFavPanel({ lsKey, currentValue, onApply }: FieldFavPanelProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [favName, setFavName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [, forceRefresh] = useState(0);

  const favKey    = `${lsKey}_fav`;
  const recentKey = `${lsKey}_recent`;
  const getFavs   = (): FavEntry[] => JSON.parse(localStorage.getItem(favKey)    ?? "[]");
  const getRecent = (): FavEntry[] => JSON.parse(localStorage.getItem(recentKey) ?? "[]");

  const persist = (key: string, list: FavEntry[]) => {
    localStorage.setItem(key, JSON.stringify(list));
    forceRefresh(n => n + 1);
  };

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allEntries = (): FavEntry[] => [...getFavs(), ...getRecent()];

  const selectedValues = (): string => {
    const all = allEntries();
    return [...selected]
      .map(id => all.find(e => e.id === id)?.value ?? "")
      .filter(Boolean)
      .join("\n");
  };

  const applyAdd = () => {
    const vals = selectedValues();
    if (!vals) return;
    const combined = currentValue.trim() ? `${currentValue.trim()}\n${vals}` : vals;
    onApply(combined);
    setIsOpen(false);
    setSelected(new Set());
    toast({ title: `${selected.size} item(s) added` });
  };

  const applyReplace = () => {
    const vals = selectedValues();
    if (!vals) return;
    onApply(vals);
    setIsOpen(false);
    setSelected(new Set());
    toast({ title: `${selected.size} item(s) applied` });
  };

  const saveFav = () => {
    if (!favName.trim()) return;
    if (!currentValue.trim()) {
      toast({ title: "Nothing to save — field is empty", variant: "destructive" });
      return;
    }
    persist(favKey, [
      ...getFavs(),
      { id: Date.now().toString(), name: favName.trim(), value: currentValue, savedAt: Date.now() },
    ]);
    setFavName("");
    toast({ title: "Saved to favourites" });
  };

  const deleteFav    = (id: string) => { persist(favKey,    getFavs().filter(e => e.id !== id));    setSelected(p => { const n = new Set(p); n.delete(id); return n; }); };
  const deleteRecent = (id: string) => { persist(recentKey, getRecent().filter(e => e.id !== id)); setSelected(p => { const n = new Set(p); n.delete(id); return n; }); };
  const entryLabel   = (e: FavEntry) => e.name || (e.value.slice(0, 60) + (e.value.length > 60 ? "…" : ""));

  const favs   = getFavs();
  const recent = getRecent();
  const total  = favs.length + recent.length;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-6 gap-1 px-2 text-xs shrink-0"
        onClick={() => { setIsOpen(true); setFavName(""); setSelected(new Set()); }}
      >
        <BookMarked className="h-3 w-3" />
        {total > 0
          ? `${favs.length} fav · ${recent.length} recent`
          : "Favourites & Recent"}
      </Button>

      <Dialog open={isOpen} onOpenChange={open => { setIsOpen(open); if (!open) setSelected(new Set()); }}>
        <DialogContent className="max-w-lg w-full flex flex-col gap-0 p-0 max-h-[85vh]">
          <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <BookMarked className="h-4 w-4" />
              Favourites &amp; Recent
            </DialogTitle>
          </DialogHeader>

          {/* ── Scrollable list ───────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-4 min-h-0">
            {total === 0 && (
              <p className="text-muted-foreground text-xs text-center py-6">
                No entries yet — use the field and they will appear here automatically.
              </p>
            )}

            {favs.length > 0 && (
              <div className="space-y-1">
                <p className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 py-1 sticky top-0 bg-background z-10">
                  <Star className="h-3.5 w-3.5" /> Favourites
                </p>
                {favs.map(e => (
                  <label
                    key={e.id}
                    className={`flex items-center gap-2.5 rounded-md border px-3 py-2 cursor-pointer transition-colors text-xs
                      ${selected.has(e.id) ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                  >
                    <Checkbox
                      checked={selected.has(e.id)}
                      onCheckedChange={() => toggle(e.id)}
                      className="shrink-0"
                    />
                    <span className="flex-1 min-w-0 break-words font-medium leading-snug">{entryLabel(e)}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={ev => { ev.preventDefault(); deleteFav(e.id); }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </label>
                ))}
              </div>
            )}

            {recent.length > 0 && (
              <div className="space-y-1">
                <p className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 py-1 sticky top-0 bg-background z-10">
                  <Clock className="h-3.5 w-3.5" /> Recently Used
                </p>
                {recent.map(e => (
                  <label
                    key={e.id}
                    className={`flex items-center gap-2.5 rounded-md border px-3 py-2 cursor-pointer transition-colors text-xs
                      ${selected.has(e.id) ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                  >
                    <Checkbox
                      checked={selected.has(e.id)}
                      onCheckedChange={() => toggle(e.id)}
                      className="shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="block break-words leading-snug">{entryLabel(e)}</span>
                      <span className="text-muted-foreground text-[10px]">{fmtDateTime(e.savedAt)}</span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={ev => { ev.preventDefault(); deleteRecent(e.id); }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* ── Footer ───────────────────────────────────────────────── */}
          <div className="shrink-0 border-t border-border px-4 py-3 space-y-2">
            {/* Apply row */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground flex-1">
                {selected.size > 0 ? `${selected.size} selected` : "Select entries above"}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-3 text-xs"
                disabled={selected.size === 0}
                onClick={applyAdd}
              >
                Add to field
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 px-3 text-xs"
                disabled={selected.size === 0}
                onClick={applyReplace}
              >
                <Check className="h-3 w-3 mr-1" /> Replace field
              </Button>
            </div>

            {/* Save favourite row */}
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
