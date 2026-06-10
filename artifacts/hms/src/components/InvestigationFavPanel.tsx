import { useState } from "react";
import { Star, Clock, X, BookMarked, Check } from "lucide-react";
import { fmtDateTime } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export type InvEntry = {
  id: string;
  name: string;
  type: string;
  bodyPart: string;
  notes: string;
  savedAt: number;
};

const FAV_KEY    = "clinicos_inv_fav";
const RECENT_KEY = "clinicos_inv_recent";

function getFavs():   InvEntry[] { return JSON.parse(localStorage.getItem(FAV_KEY)    ?? "[]"); }
function getRecent(): InvEntry[] { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); }

export function trackInvestigationRecent(entry: { type: string; bodyPart: string; notes: string }) {
  if (!entry.type.trim()) return;
  const stored = getRecent();
  const deduped = stored.filter(e => !(e.type === entry.type && e.bodyPart === entry.bodyPart)).slice(0, 8);
  localStorage.setItem(RECENT_KEY, JSON.stringify([
    { id: Date.now().toString(), name: "", ...entry, savedAt: Date.now() },
    ...deduped,
  ]));
}

interface InvestigationFavPanelProps {
  type: string;
  bodyPart: string;
  notes: string;
  onApply: (entry: { type: string; bodyPart: string; notes: string }) => void;
  onApplyMultiple?: (entries: Array<{ type: string; bodyPart: string; notes: string }>) => void;
}

export function InvestigationFavPanel({ type, bodyPart, notes, onApply, onApplyMultiple }: InvestigationFavPanelProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [favName, setFavName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [, forceRefresh] = useState(0);

  const persist = (key: string, list: InvEntry[]) => {
    localStorage.setItem(key, JSON.stringify(list));
    forceRefresh(n => n + 1);
  };

  const toggle = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const applySelected = () => {
    const all = [...getFavs(), ...getRecent()];
    const entries = [...selected]
      .map(id => all.find(e => e.id === id))
      .filter((e): e is InvEntry => !!e)
      .map(e => ({ type: e.type, bodyPart: e.bodyPart, notes: e.notes }));
    if (!entries.length) return;
    if (entries.length === 1) {
      onApply(entries[0]);
    } else if (onApplyMultiple) {
      onApplyMultiple(entries);
    } else {
      onApply(entries[0]);
    }
    setSelected(new Set());
    setIsOpen(false);
  };

  const saveFav = () => {
    if (!type.trim()) {
      toast({ title: "Select an investigation type first", variant: "destructive" });
      return;
    }
    const name = favName.trim() || `${type}${bodyPart ? ` — ${bodyPart}` : ""}`;
    persist(FAV_KEY, [...getFavs(), { id: Date.now().toString(), name, type, bodyPart, notes, savedAt: Date.now() }]);
    setFavName("");
    toast({ title: "Saved to favourites" });
  };

  const deleteFav    = (id: string) => { persist(FAV_KEY,    getFavs().filter(e => e.id !== id)); setSelected(p => { const n = new Set(p); n.delete(id); return n; }); };
  const deleteRecent = (id: string) => { persist(RECENT_KEY, getRecent().filter(e => e.id !== id)); setSelected(p => { const n = new Set(p); n.delete(id); return n; }); };

  const favs   = getFavs();
  const recent = getRecent();
  const total  = favs.length + recent.length;

  const EntryRow = ({ entry, onDelete }: { entry: InvEntry; onDelete: () => void }) => {
    const isSelected = selected.has(entry.id);
    return (
      <div
        className={`flex items-center gap-2 rounded border px-2 py-1.5 cursor-pointer transition-colors
          ${isSelected ? "border-primary bg-primary/8 ring-1 ring-primary/30" : "border-border bg-card hover:bg-muted/50"}`}
        onClick={() => toggle(entry.id)}
      >
        <div className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors
          ${isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
          {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          {entry.name && <p className="text-xs font-semibold truncate">{entry.name}</p>}
          <div className="flex items-center gap-1 flex-wrap mt-0.5">
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{entry.type}</Badge>
            {entry.bodyPart && (
              <Badge variant="outline" className="text-[10px] h-4 px-1.5">{entry.bodyPart}</Badge>
            )}
          </div>
          {entry.notes && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{entry.notes}</p>
          )}
        </div>
        <Button
          type="button" size="sm" variant="ghost"
          className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={e => { e.stopPropagation(); onDelete(); }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">Quick fill</span>
        <Button
          type="button" size="sm"
          variant={isOpen ? "secondary" : "ghost"}
          className="h-6 gap-1 px-2 text-xs"
          onClick={() => { setIsOpen(v => !v); setFavName(""); setSelected(new Set()); }}
        >
          <BookMarked className="h-3 w-3" />
          {total > 0 ? `${favs.length} fav · ${recent.length} recent` : "Favourites & Recent"}
        </Button>
      </div>

      {isOpen && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3 text-xs">
          {total === 0 && (
            <p className="text-muted-foreground text-center py-1">
              No entries yet — order an investigation and it will appear here automatically.
            </p>
          )}

          {favs.length > 0 && (
            <div className="space-y-1">
              <p className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                <Star className="h-3 w-3" /> Favourites
              </p>
              {favs.map(e => (
                <EntryRow key={e.id} entry={e} onDelete={() => deleteFav(e.id)} />
              ))}
            </div>
          )}

          {recent.length > 0 && (
            <div className="space-y-1">
              <p className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
                <Clock className="h-3 w-3" /> Recently Ordered
              </p>
              {recent.map(e => (
                <div key={e.id}>
                  <EntryRow entry={e} onDelete={() => deleteRecent(e.id)} />
                  <p className="text-[10px] text-muted-foreground pl-2 mt-0.5">{fmtDateTime(e.savedAt)}</p>
                </div>
              ))}
            </div>
          )}

          {total > 0 && (
            <div className="flex items-center gap-2 pt-1 border-t border-border">
              <span className="flex-1 text-muted-foreground">
                {selected.size > 0 ? `${selected.size} selected` : "Click entries to select"}
              </span>
              <Button
                type="button" size="sm" className="h-7 px-3 text-xs"
                disabled={selected.size === 0}
                onClick={applySelected}
              >
                <Check className="h-3 w-3 mr-1" />
                {selected.size > 1 ? `Order ${selected.size} investigations` : "Apply"}
              </Button>
            </div>
          )}

          <div className="flex gap-1.5 border-t border-border pt-2">
            <Input
              className="h-7 text-xs flex-1"
              value={favName}
              onChange={e => setFavName(e.target.value)}
              placeholder={type ? `Name this favourite (default: ${type}${bodyPart ? ` — ${bodyPart}` : ""})` : "Select type first…"}
              onKeyDown={e => e.key === "Enter" && saveFav()}
            />
            <Button type="button" size="sm" className="h-7 px-3 text-xs shrink-0" onClick={saveFav}>
              <Star className="h-3 w-3 mr-1" /> Save
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
