import { useState } from "react";
import { Star, Clock, X, BookMarked } from "lucide-react";
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
}

export function InvestigationFavPanel({ type, bodyPart, notes, onApply }: InvestigationFavPanelProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [favName, setFavName] = useState("");
  const [, forceRefresh] = useState(0);

  const persist = (key: string, list: InvEntry[]) => {
    localStorage.setItem(key, JSON.stringify(list));
    forceRefresh(n => n + 1);
  };

  const handleApply = (entry: InvEntry) => {
    onApply({ type: entry.type, bodyPart: entry.bodyPart, notes: entry.notes });
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

  const deleteFav    = (id: string) => persist(FAV_KEY,    getFavs().filter(e => e.id !== id));
  const deleteRecent = (id: string) => persist(RECENT_KEY, getRecent().filter(e => e.id !== id));

  const favs   = getFavs();
  const recent = getRecent();
  const total  = favs.length + recent.length;

  const EntryRow = ({ entry, onDelete }: { entry: InvEntry; onDelete: () => void }) => (
    <div className="flex items-center gap-2 rounded border border-border bg-card px-2 py-1.5">
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
        type="button"
        size="sm"
        variant="ghost"
        className="h-6 px-2 text-xs shrink-0"
        onClick={() => handleApply(entry)}
      >
        Apply
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">Quick fill</span>
        <Button
          type="button"
          size="sm"
          variant={isOpen ? "secondary" : "ghost"}
          className="h-6 gap-1 px-2 text-xs"
          onClick={() => { setIsOpen(v => !v); setFavName(""); }}
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
                  <p className="text-[10px] text-muted-foreground pl-2 mt-0.5">
                    {fmtDateTime(e.savedAt)}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-1.5 pt-1 border-t border-border">
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
