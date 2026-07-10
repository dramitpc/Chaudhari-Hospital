---
name: Query invalidation outside React hooks
description: How to trigger React Query cache invalidation from plain functions that aren't React components/hooks (e.g. onBlur handlers, module-level helpers).
---

When a "track recent" / autosave-style action needs to write data and refresh cached lists, but is called from a plain function (not a component or custom hook — e.g. an `onBlur` handler defined outside the render, or a helper exported from a utils file), you can't call `useQueryClient()` or other hooks there.

Pattern that works:
- Export the app's `QueryClient` instance itself (e.g. `export const queryClient = new QueryClient(...)` from the root App file) instead of only relying on the `QueryClientProvider`.
- In the plain helper, import the generated raw API function directly (not the generated React Query hook), call it, then call `queryClient.invalidateQueries({ queryKey: ... })` using the same query key the hook-based reads use.
- Reserve the `useXyz()` generated hooks for actual components/hooks; use the raw `createXyz`/`listXyz` functions for fire-and-forget writes from non-component code.

**Why:** React hooks (including `useQueryClient`) can only be called inside function components or other hooks. Fire-and-forget writes from `onBlur`/module-level code need a non-hook path to both mutate and invalidate the cache so UI relying on the hook-based query stays in sync.

**How to apply:** Any time you're migrating localStorage-based "recent items" or similar background-tracking logic (invoked outside the component tree) to a server-backed store with React Query, check whether the call site is a hook context or a plain function — pick the raw-API-plus-exported-queryClient path for the latter.
