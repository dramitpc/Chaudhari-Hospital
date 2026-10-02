import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateTokenStatus, getGetQueueQueryKey, type QueueToken, type TokenStatusUpdate } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export const queueStatusLabels: Record<string, string> = {
  awaiting_investigations: "Awaiting investigations",
  ready_for_review: "Ready for review",
  paused: "Paused",
};

export default function ConsultationTiming({ token, canManage, onResume }: {
  token: QueueToken;
  canManage: boolean;
  onResume?: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const client = useQueryClient();
  const { toast } = useToast();
  const mutation = useUpdateTokenStatus();
  useEffect(() => {
    if (!token.activeStartedAt) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [token.activeStartedAt]);
  const active = token.activeAccumulatedSeconds == null ? null
    : token.activeAccumulatedSeconds + (token.activeStartedAt
      ? Math.max(0, Math.floor((now - new Date(token.activeStartedAt).getTime()) / 1000)) : 0);
  const transition = (status: TokenStatusUpdate["status"]) => {
    mutation.mutate({ id: token.id, data: { status } }, {
      onSuccess: () => {
        client.invalidateQueries({ queryKey: getGetQueueQueryKey() });
        if (status === "in_consultation") onResume?.();
      },
      onError: (error) => toast({ title: "Could not update consultation timing", description: error.message, variant: "destructive" }),
    });
  };
  const paused = ["paused", "awaiting_investigations", "ready_for_review"].includes(token.status);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {token.consultationStartedAt && (
        <span className="text-muted-foreground" data-testid={`timing-${token.id}`}>
          {active === null ? "Elapsed-only (legacy record)" : `Active: ${Math.floor(active / 60)}m ${active % 60}s`}
          {token.activeStartedAt && " · Running"}
          {paused && ` · ${queueStatusLabels[token.status]}`}
          {token.elapsedConsultationMinutes != null && ` · Elapsed: ${token.elapsedConsultationMinutes} min`}
        </span>
      )}
      {canManage && token.status === "in_consultation" && (
        <>
          <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => transition("awaiting_investigations")}>
            Awaiting investigations
          </Button>
          <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => transition("paused")}>Pause</Button>
        </>
      )}
      {canManage && (token.status === "awaiting_investigations" || token.status === "paused") && (
        <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => transition("ready_for_review")}>Ready for review</Button>
      )}
      {canManage && !!token.consultationId && (paused || token.status === "called") && (
        <Button size="sm" disabled={mutation.isPending} onClick={() => transition("in_consultation")}>Resume consultation</Button>
      )}
    </div>
  );
}