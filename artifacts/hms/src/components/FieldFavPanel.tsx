import { useState } from "react";
import { BookMarked, Star, Clock, X } from "lucide-react";
import { fmtDateTime } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

  const applyEntry = (entry: FavEntry) => {
    const combined = currentValue.trim() ? `${currentValue.trim()}\n${entry.value}` : entry.value;
    onApply(combined);
    setIsOpen(false);
    toast({ title: "Added to field" });
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

  const deleteFav    = (id: string) => persist(favKey,    getFavs().filter(e => e.id !== id));
  const deleteRecent = (id: string) => persist(recentKey, getRecent().filter(e => e.id !== id));
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
        onClick={() => { setIsOpen(true); setFavName(""); }}
      >
        <BookMarked className="h-3 w-3" />
        {total > 0
          ? `${favs.length} fav · ${recent.length} recent`
          : "Favourites & Recent"}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg w-full flex flex-col gap-0 p-0 max-h-[85vh]">
          <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <BookMarked className="h-4 w-4" />
              Favourites &amp; Recent
            </DialogTitle>
          </DialogHeader>

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
                  <div
                    key={e.id}
                    className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-primary/5 hover:border-primary transition-colors text-xs"
                    onClick={() => applyEntry(e)}
                  >
                    <span className="flex-1 min-w-0 break-words font-medium leading-snug">{entryLabel(e)}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={ev => { ev.stopPropagation(); deleteFav(e.id); }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {recent.length > 0 && (
              <div className="space-y-1">
                <p className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 py-1 sticky top-0 bg-background z-10">
                  <Clock className="h-3.5 w-3.5" /> Recently Used
                </p>
                {recent.map(e => (
                  <div
                    key={e.id}
                    className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-primary/5 hover:border-primary transition-colors text-xs"
                    onClick={() => applyEntry(e)}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="block break-words leading-snug">{entryLabel(e)}</span>
                      <span className="text-muted-foreground text-[10px]">{fmtDateTime(e.savedAt)}</span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={ev => { ev.stopPropagation(); deleteRecent(e.id); }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-border px-4 py-3">
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
