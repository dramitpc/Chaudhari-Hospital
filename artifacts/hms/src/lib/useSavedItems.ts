import { useQueryClient } from "@tanstack/react-query";
import {
  useListSavedItems,
  useCreateSavedItem,
  useDeleteSavedItem,
  getListSavedItemsQueryKey,
} from "@workspace/api-client-react";

export type SavedItem<T extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  namespace: string;
  kind: "favorite" | "recent";
  name: string;
  payload: T;
  createdAt: string;
};

export function useSavedItems<T extends Record<string, unknown> = Record<string, unknown>>(namespace: string) {
  const queryClient = useQueryClient();
  const queryKey = getListSavedItemsQueryKey({ namespace });

  const { data } = useListSavedItems({ namespace }, { query: { queryKey, staleTime: 30_000 } });
  const all = (data?.data ?? []) as SavedItem<T>[];
  const favorites = all.filter(i => i.kind === "favorite");
  const recents = all.filter(i => i.kind === "recent");

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createMutation = useCreateSavedItem({ mutation: { onSuccess: invalidate } });
  const deleteMutation = useDeleteSavedItem({ mutation: { onSuccess: invalidate } });

  const saveFavorite = (name: string, payload: T) =>
    createMutation.mutateAsync({ data: { namespace, kind: "favorite", name, payload } });

  const trackRecent = (payload: T, dedupeKey: string, name = "") =>
    createMutation.mutateAsync({ data: { namespace, kind: "recent", name, payload, dedupeKey } });

  const deleteItem = (id: string) => deleteMutation.mutateAsync({ id });

  return { favorites, recents, saveFavorite, trackRecent, deleteItem };
}
