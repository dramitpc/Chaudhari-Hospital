export type FavEntry = { id: string; name: string; value: string; savedAt: number };

export function trackFieldRecent(lsKey: string, value: string) {
  if (!value.trim()) return;
  const key = `${lsKey}_recent`;
  const stored: FavEntry[] = JSON.parse(localStorage.getItem(key) ?? "[]");
  const deduped = stored.filter(e => e.value !== value).slice(0, 4);
  localStorage.setItem(key, JSON.stringify([
    { id: Date.now().toString(), name: "", value, savedAt: Date.now() },
    ...deduped,
  ]));
}
