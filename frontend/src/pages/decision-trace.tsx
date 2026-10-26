import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, m } from "motion/react";
import { ArrowLeft, Braces, ClipboardCheck, FileSearch, History, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { api, type DecisionDetail, type RetrievedChunk } from "@/api/client";
import { qk, useDecision } from "@/api/hooks";
import { RiskBadge, RuleChip, StatusBadge } from "@/components/app/badges";
import { PageSkeleton } from "@/components/app/page-skeleton";
import { ErrorState, PageHeader } from "@/components/app/states";
import { Timeline } from "@/components/magic/timeline";
import { Button } from "@/components/ui/button";
import { Badge, Card, Skeleton } from "@/components/ui/primitives";
import { formatDateTime, formatINR, shortHash } from "@/lib/format";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

const TraceGraph = lazy(() => import("@/components/trace/trace-graph"));

type Reg = { reg_id: string; section: string; reason: string; citation_chunk_ids: string[] };
const STOP = new Set("the and for with that this from must shall such which have been their under than more into each where".split(" "));
const tokens = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9₹]+/g)?.filter((t) => t.length > 3 && !STOP.has(t)) ?? []);

/** Split a clause into sentences and mark those that best support the model's stated reason. */
function HighlightedClause({ text, reason }: { text: string; reason?: string }) {
  const sentences = text.split(/(?<=[.;])\s+/);
  const reasonTokens = tokens(reason ?? "");
  const scores = sentences.map((s) => [...tokens(s)].filter((t) => reasonTokens.has(t)).length);
  const best = Math.max(0, ...scores);
  return (
    <p className="text-sm leading-relaxed">
      {sentences.map((s, i) => {
        const hit = reason && best >= 2 && scores[i] >= Math.max(2, best - 1);
        return (
          <span key={i}>
            {hit ? (
              <m.mark
                initial={{ backgroundSize: "0% 100%" }}
                animate={{ backgroundSize: "100% 100%" }}
                transition={{ duration: 0.8, delay: 0.2 + i * 0.05 }}
                className="rounded-sm bg-transparent bg-[linear-gradient(var(--brand-glow),var(--brand-glow))] bg-no-repeat px-0.5 text-foreground"
              >
                {s}
              </m.mark>
            ) : (
              <span className="text-muted-foreground">{s}</span>
            )}{" "}
          </span>
        );
      })}
    </p>
  );
}

function ClausePanel({ d, chunk }: { d: DecisionDetail; chunk: RetrievedChunk | undefined }) {
  const regs = (d.output.applicable_regulations as Reg[] | undefined) ?? [];
  const rejected = (d.output.rejected_regulations as (Reg & { reason_rejected: string })[] | undefined) ?? [];
  const citing = chunk ? regs.find((r) => r.citation_chunk_ids.includes(chunk.chunk_id)) : undefined;

  return (
    <div className="space-y-5">
      <AnimatePresence mode="wait">
        {chunk ? (
          <m.div key={chunk.chunk_id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={spring.gentle} className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="mono">{chunk.reg_id}</Badge>
              <Badge variant="default">v{chunk.version}</Badge>
              <Badge variant="mono" title={chunk.content_hash}>sha256 {shortHash(chunk.content_hash, 6)}</Badge>
              <Badge variant={chunk.method === "rule_ref" ? "default" : "outline"}>{chunk.method === "rule_ref" ? "rule source" : `hybrid · bm25 #${chunk.bm25_rank ?? "–"} · vec #${chunk.vector_rank ?? "–"}`}</Badge>
              {citing ? <Badge variant="low"><ShieldCheck /> cited</Badge> : <Badge variant="outline">context only</Badge>}
            </div>
            <h3 className="font-semibold">{chunk.heading}</h3>
            <HighlightedClause text={chunk.text} reason={citing?.reason} />
            <p className="font-mono text-[11px] text-muted-foreground">{chunk.chunk_id}</p>
          </m.div>
        ) : (
          <p className="text-sm text-muted-foreground">Select a clause node in the graph.</p>
        )}
      </AnimatePresence>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Applicable regulations</h4>
        <div className="space-y-2">
          {regs.length === 0 && <p className="text-sm text-muted-foreground">None identified.</p>}
          {regs.map((r) => (
            <div key={r.reg_id} className="rounded-xl border border-border p-3">
              <div className="font-mono text-xs font-semibold">{r.reg_id}</div>
              <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {r.citation_chunk_ids.map((c) => <Badge key={c} variant="low" className="font-mono"><ShieldCheck />{c.split("#")[1]}</Badge>)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {(d.invalid_citations.length > 0 || rejected.length > 0) && (
        <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-risk-high/30 bg-risk-high-bg p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-risk-high">
            <ShieldAlert className="size-4" /> Guardrail removed {d.invalid_citations.length} citation(s)
          </div>
          <ul className="space-y-1">
            {d.invalid_citations.map((c, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono text-muted-foreground line-through decoration-risk-high decoration-2">{String(c.chunk_id)}</span>
                <span className="rounded bg-risk-high/15 px-1.5 text-[10px] text-risk-high">{String(c.reason)}</span>
              </li>
            ))}
            {rejected.map((r) => (
              <li key={r.reg_id} className="text-xs text-muted-foreground">
                <span className="font-mono line-through">{r.reg_id}</span> — {r.reason_rejected}
              </li>
            ))}
          </ul>
        </m.div>
      )}
    </div>
  );
}

export default function DecisionTrace() {
  const id = Number(useParams().id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: d, error, isLoading, refetch } = useDecision(id);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"clauses" | "rules" | "raw" | "history">("clauses");
  const [busy, setBusy] = useState(false);
  const chunk = useMemo(() => d?.retrieved.find((c) => c.chunk_id === (selected ?? d.retrieved[0]?.chunk_id)), [d, selected]);

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading || !d) return <PageSkeleton cards={0} />;

  const reanalyze = async () => {
    setBusy(true);
    try {
      const nd = await api.reanalyze(d.transaction_id);
      qc.invalidateQueries({ queryKey: qk.queue });
      toast.success(`Re-analysed as decision #${nd.id}`);
      qc.setQueryData(qk.decision(nd.id), nd);
      navigate(`/app/decisions/${nd.id}`, { replace: true });
    } catch (e) {
      toast.error("Re-analysis failed", { description: String(e) });
    } finally {
      setBusy(false);
    }
  };

  const TABS = [
    { id: "clauses", label: "Clauses", icon: FileSearch },
    { id: "rules", label: "Rules", icon: ClipboardCheck },
    { id: "raw", label: "LLM output", icon: Braces },
    { id: "history", label: "History", icon: History },
  ] as const;

  return (
    <div>
      <Link to="/app/review" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" /> Back to review queue
      </Link>
      <PageHeader
        eyebrow={`Decision #${d.id} · ${d.prompt_version}`}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{formatINR(d.amount_inr)}</span>
            <RiskBadge level={d.risk_level} />
            <StatusBadge status={d.status} />
          </span>
        }
        description={d.summary}
        actions={
          <>
            <Button variant="outline" onClick={reanalyze} disabled={busy}>
              <RefreshCw className={cn(busy && "animate-spin")} /> Re-analyse
            </Button>
            <Button asChild>
              <Link to="/app/review">Review</Link>
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5">{d.rules.map((r) => <RuleChip key={r} id={r} />)}</div>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_440px]">
        <Card className="h-[460px] overflow-hidden sm:h-[540px] 2xl:h-[680px]">
          <Suspense fallback={<Skeleton className="h-full rounded-2xl" />}>
            <TraceGraph decision={d} selectedChunk={chunk?.chunk_id ?? null} onSelectChunk={(c) => { setSelected(c); setTab("clauses"); }} />
          </Suspense>
        </Card>

        <Card className="flex max-h-[680px] flex-col overflow-hidden">
          <div role="tablist" aria-label="Trace details" className="flex gap-1 border-b border-border p-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn("relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors", tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {tab === t.id && <m.span layoutId="trace-tab" className="absolute inset-0 rounded-lg bg-accent" transition={spring.snappy} />}
                <t.icon className="relative size-3.5" />
                <span className="relative">{t.label}</span>
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-5" role="tabpanel">
            <AnimatePresence mode="wait">
              <m.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
                {tab === "clauses" && <ClausePanel d={d} chunk={chunk} />}
                {tab === "rules" && (
                  <div className="space-y-3">
                    {d.rules_fired.length === 0 && <p className="text-sm text-muted-foreground">No rule fired.</p>}
                    {d.rules_fired.map((r) => (
                      <div key={r.rule_id} className="rounded-xl border border-border p-3">
                        <div className="flex items-center justify-between">
                          <RuleChip id={r.rule_id} />
                          <Badge variant={r.severity === "low" ? "low" : r.severity === "medium" ? "medium" : "high"}>{r.severity}</Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{r.description}</p>
                        <ul className="mt-2 space-y-1">
                          {r.evidence.map((e, i) => (
                            <li key={i} className="flex items-center gap-2 font-mono text-[11px]">
                              <span className={e.result ? "text-risk-low" : "text-risk-high"}>{e.result ? "✓" : "✗"}</span>
                              <span className="truncate">{String(e.expr)} {String(e.op)} {JSON.stringify(e.expected)}</span>
                              <span className="ml-auto shrink-0 text-muted-foreground">= {JSON.stringify(e.actual)}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2 flex flex-wrap gap-1">{r.source_refs.map((s) => <Badge key={s} variant="mono">{s}</Badge>)}</div>
                      </div>
                    ))}
                  </div>
                )}
                {tab === "raw" && (
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground">Retrieval query</div>
                    <p className="rounded-lg bg-muted p-2 font-mono text-[11px]">{d.retrieval_query}</p>
                    <div className="text-xs text-muted-foreground">Validated output (after guardrail)</div>
                    <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-3 font-mono text-[11px] leading-relaxed">{JSON.stringify(d.output, null, 2)}</pre>
                  </div>
                )}
                {tab === "history" && (
                  <Timeline
                    items={[
                      {
                        key: "analysed",
                        tone: "brand" as const,
                        content: (
                          <div>
                            <div className="text-xs font-medium">Analysed<span className="ml-2 font-normal text-muted-foreground">by {d.model_name}</span></div>
                            <div className="text-[11px] text-muted-foreground">{formatDateTime(d.created_at)}</div>
                          </div>
                        ),
                      },
                      ...d.reviews.map((r) => ({
                        key: `r${r.id}`,
                        tone: r.action === "approve" || r.action === "modify" ? ("low" as const) : r.action === "reject" ? ("high" as const) : ("brand" as const),
                        content: (
                          <div>
                            <div className="text-xs font-medium capitalize">{r.action.replace("_", " ")}<span className="ml-2 font-normal normal-case text-muted-foreground">by {r.reviewer}</span></div>
                            <div className="text-[11px] text-muted-foreground">{formatDateTime(r.created_at)}{r.comment ? ` · “${r.comment}”` : ""}</div>
                          </div>
                        ),
                      })),
                    ]}
                  />
                )}
              </m.div>
            </AnimatePresence>
          </div>
        </Card>
      </div>
    </div>
  );
}
