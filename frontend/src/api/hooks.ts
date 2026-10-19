import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, type DecisionDetail, type DecisionSummary, type ReviewIn } from "./client";

export const qk = {
  stats: ["stats"] as const,
  meta: ["meta"] as const,
  queue: ["queue"] as const,
  decision: (id: number) => ["decision", id] as const,
  decisions: ["decisions"] as const,
  transactions: (p: object) => ["transactions", p] as const,
  documents: ["documents"] as const,
  document: (id: string, v?: number) => ["document", id, v] as const,
  audit: ["audit"] as const,
  eval: ["eval"] as const,
  reports: ["reports"] as const,
  runs: ["runs"] as const,
};

export const useStats = () => useQuery({ queryKey: qk.stats, queryFn: api.stats, refetchInterval: 15_000 });
export const useMeta = () => useQuery({ queryKey: qk.meta, queryFn: api.meta, staleTime: Infinity });
export const useQueue = () => useQuery({ queryKey: qk.queue, queryFn: () => api.queue(true) });
export const useDecision = (id: number) =>
  useQuery({ queryKey: qk.decision(id), queryFn: () => api.decision(id), enabled: Number.isFinite(id) });
export const useTransactions = (params: Record<string, string | number | boolean | undefined>) =>
  useQuery({ queryKey: qk.transactions(params), queryFn: () => api.transactions(params), placeholderData: keepPreviousData });
export const useDocuments = () => useQuery({ queryKey: qk.documents, queryFn: api.documents });
export const useDocument = (regId: string | null, version?: number) =>
  useQuery({ queryKey: qk.document(regId ?? "", version), queryFn: () => api.document(regId!, version), enabled: !!regId });
export const useAudit = () => useQuery({ queryKey: qk.audit, queryFn: () => api.audit(1, 400) });
export const useEval = () => useQuery({ queryKey: qk.eval, queryFn: api.evaluation, retry: false });
export const useReports = () => useQuery({ queryKey: qk.reports, queryFn: api.reports });

/** Review action with an optimistic status update in the queue. */
export function useReviewAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: ReviewIn }) => api.review(id, body),
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: qk.queue });
      const prev = qc.getQueryData<DecisionSummary[]>(qk.queue);
      const optimistic: Record<string, string> = { start_review: "in_review", reject: "rejected" };
      const next = optimistic[body.action];
      if (prev && next) {
        qc.setQueryData<DecisionSummary[]>(qk.queue, prev.map((d) => (d.id === id ? { ...d, status: next } : d)));
      }
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.queue, ctx.prev);
      toast.error("Review action failed", { description: err instanceof Error ? err.message : String(err) });
    },
    onSuccess: (d: DecisionDetail) => {
      qc.setQueryData(qk.decision(d.id), d);
      qc.setQueryData<DecisionSummary[]>(qk.queue, (prev) =>
        prev?.map((x) => (x.id === d.id ? { ...x, ...d } : x)),
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.queue });
      qc.invalidateQueries({ queryKey: qk.stats });
      qc.invalidateQueries({ queryKey: qk.reports });
      qc.invalidateQueries({ queryKey: qk.audit });
    },
  });
}

/** Subscribe to a Server-Sent Events endpoint; events are JSON objects with a `type`. */
export function useEventStream<T extends { type: string }>(url: string | null, onEvent: (e: T) => void) {
  const handler = useRef(onEvent);
  const [state, setState] = useState<"idle" | "open" | "closed" | "error">("idle");
  useEffect(() => {
    handler.current = onEvent;
  });
  useEffect(() => {
    if (!url) return;
    const es = new EventSource(url);
    es.onopen = () => setState("open");
    es.onmessage = (msg) => {
      const data = JSON.parse(msg.data) as T;
      handler.current(data);
      if (data.type === "done" || data.type === "error") {
        es.close();
        setState("closed");
      }
    };
    es.onerror = () => {
      es.close();
      setState((s) => (s === "closed" ? s : "error"));
    };
    return () => es.close();
  }, [url]);
  return state;
}
