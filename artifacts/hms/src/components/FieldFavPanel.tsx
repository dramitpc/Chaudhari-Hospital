import { useState } from "react";
import { BookMarked, Star, Clock, X } from "lucide-react";
import { fmtDateTime } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [, forceRefresh] = useState(0);

  const favKey    = `${lsKey}_fav`;
  const recentKey = `${lsKey}_recent`;
  const getFavs   = (): FavEntry[] => JSON.parse(localStorage.getItem(favKey)    ?? "[]");
  const getRecent = (): FavEntry[] => JSON.parse(localStorage.getItem(recentKey) ?? "[]");

  const persist = (key: string, list: FavEntry[]) => {
    localStorage.setItem(key, JSON.stringify(list));
    forceRefresh(n => n + 1);
  };

  const handleApply = (value: string) => {
    onApply(value);
    setIsOpen(false);
    toast({ title: "Applied" });
  };

  const saveFav = () => {
    if (!favName.trim()) return;
    if (!currentValue.trim()) {
      toast({ title: "Nothing to save — field is empty", variant: "destructive" });
      return;
    }
    persist(favKey, [...getFavs(), { id: Date.now().toString(), name: favName.trim(), value: currentValue, savedAt: Date.now() }]);
    setFavName("");
    toast({ title: "Saved to favourites" });
  };

  const deleteFav    = (id: string) => persist(favKey,    getFavs().filter(e => e.id !== id));
  const deleteRecent = (id: string) => persist(recentKey, getRecent().filter(e => e.id !== id));
  const entryLabel   = (e: FavEntry) => e.name || (e.value.slice(0, 50) + (e.value.length > 50 ? "…" : ""));

  const favs   = getFavs();
  const recent = getRecent();

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={isOpen ? "secondary" : "ghost"}
        className="h-6 gap-1 px-2 text-xs shrink-0"
        onClick={() => { setIsOpen(v => !v); setFavName(""); }}
      >
        <BookMarked className="h-3 w-3" />
        {favs.length > 0 || recent.length > 0
          ? `${favs.length} fav · ${recent.length} recent`
          : "Favourites & Recent"}
      </Button>

      {isOpen && (
        <div className="col-span-full rounded-lg border border-border bg-muted/30 p-3 space-y-3 text-xs">
          {favs.length === 0 && recent.length === 0 && (
            <p className="text-muted-foreground text-center py-1">
              No entries yet — use the field and they will appear here automatically.
            </p>
          )}

          {favs.length > 0 && (
            <div className="space-y-1">
              <p className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                <Star className="h-3 w-3" /> Favourites
              </p>
              {favs.map(e => (
                <div key={e.id} className="flex items-center gap-2 rounded border border-border bg-card px-2 py-1">
                  <span className="truncate flex-1 font-medium">{entryLabel(e)}</span>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs shrink-0" onClick={() => handleApply(e.value)}>Apply</Button>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => deleteFav(e.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {recent.length > 0 && (
            <div className="space-y-1">
              <p className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
                <Clock className="h-3 w-3" /> Recently Used
              </p>
              {recent.map(e => (
                <div key={e.id} className="flex items-center gap-2 rounded border border-border bg-card px-2 py-1">
                  <div className="flex-1 min-w-0">
                    <span className="truncate block">{entryLabel(e)}</span>
                    <span className="text-muted-foreground text-[10px]">
                      {fmtDateTime(e.savedAt)}
                    </span>
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs shrink-0" onClick={() => handleApply(e.value)}>Apply</Button>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => deleteRecent(e.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-1.5 pt-1 border-t border-border">
            <Input
              className="h-7 text-xs flex-1"
              value={favName}
              onChange={e => setFavName(e.target.value)}
              placeholder="Name this favourite…"
              onKeyDown={e => e.key === "Enter" && saveFav()}
            />
            <Button type="button" size="sm" className="h-7 px-3 text-xs" onClick={saveFav}>
              <Star className="h-3 w-3 mr-1" /> Save
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
