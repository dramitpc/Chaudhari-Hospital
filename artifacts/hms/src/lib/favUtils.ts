import { createSavedItem, getListSavedItemsQueryKey } from "@workspace/api-client-react";
import { queryClient } from "@/App";

export type FavEntry = { id: string; name: string; value: string; savedAt: number };

export async function trackFieldRecent(lsKey: string, value: string) {
  if (!value.trim()) return;
  const namespace = `field:${lsKey}`;
  await createSavedItem({
    namespace,
    kind: "recent",
    name: "",
    payload: { value },
    dedupeKey: value,
  });
  queryClient.invalidateQueries({ queryKey: getListSavedItemsQueryKey({ namespace }) });
}
