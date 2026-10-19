import { useMutation, useQueryClient } from "@tanstack/react-query";
import { m } from "motion/react";
import { CheckCircle2, FlaskConical, RefreshCw, Timer, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { qk, useEval } from "@/api/hooks";
import { RuleChip } from "@/components/app/badges";
import { PageSkeleton } from "@/components/app/page-skeleton";
import { EmptyState, PageHeader } from "@/components/app/states";
import { CircularProgress } from "@/components/magic/circular-progress";
import { NumberTicker } from "@/components/magic/number-ticker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { formatDateTime, formatPct } from "@/lib/format";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { cn } from "@/lib/utils";

function Gauge({ label, value, hint, color = "var(--brand)" }: { label: string; value: number; hint: string; color?: string }) {
  return (
    <m.div variants={fadeUp}>
      <Card className="flex h-full flex-col items-center gap-3 p-5 text-center">
        <CircularProgress value={value} size={132} stroke={9} color={color} label={label}>
          <div>
            <div className="font-mono text-2xl font-semibold tabular">
              <NumberTicker value={value * 100} decimals={1} format={(n) => `${n.toFixed(1)}%`} />
            </div>
          </div>
        </CircularProgress>
        <div>
          <div className="text-sm font-semibold">{label}</div>
          <div className="text-xs text-muted-foreground">{hint}</div>
        </div>
      </Card>
    </m.div>
  );
}

export default function Evaluation() {
  const qc = useQueryClient();
  const { data: r, isLoading, error } = useEval();
  const rerun = useMutation({
    mutationFn: api.runEvaluation,
    onSuccess: (res) => {
      qc.setQueryData(qk.eval, res);
      toast.success("Evaluation refreshed", { description: `Rules F1 ${res.rules.f1.toFixed(3)}` });
    },
    onError: (e) => toast.error("Evaluation failed", { description: String(e) }),
  });

  if (isLoading) return <PageSkeleton cards={5} />;
  if (error || !r)
    return (
      <div>
        <PageHeader eyebrow="Quality" title="Evaluation" />
        <EmptyState title="No evaluation yet" description="Run the seed or evaluate the current decisions now." action={<Button onClick={() => rerun.mutate()}><FlaskConical /> Run evaluation</Button>} />
      </div>
    );

  const c = { tp: r.confusion.tp ?? 0, fp: r.confusion.fp ?? 0, fn: r.confusion.fn ?? 0, tn: r.confusion.tn ?? 0 };
  const cells = [
    { k: "tp", label: "Flagged · expected", v: c.tp, good: true },
    { k: "fn", label: "Missed · expected", v: c.fn, good: false },
    { k: "fp", label: "Flagged · not expected", v: c.fp, good: false },
    { k: "tn", label: "Clean · not expected", v: c.tn, good: true },
  ];
  const maxCell = Math.max(1, ...cells.map((x) => x.v));

  return (
    <div>
      <PageHeader
        eyebrow="Quality"
        title="Evaluation"
        description={`Against synthetic ground truth · ${r.transactions_evaluated} transactions · ${r.provider ?? "—"} · ${formatDateTime(r.generated_at)}`}
        actions={
          <Button variant="outline" onClick={() => rerun.mutate()} disabled={rerun.isPending}>
            <RefreshCw className={cn(rerun.isPending && "animate-spin")} /> Re-run on current decisions
          </Button>
        }
      />

      <m.div variants={staggerContainer(0.07)} initial="hidden" animate="show" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Gauge label="Rules F1" value={r.rules.f1} hint={`P ${formatPct(r.rules.precision)} · R ${formatPct(r.rules.recall)}`} />
        <Gauge label="Obligations F1" value={r.obligations.f1} hint={`P ${formatPct(r.obligations.precision)} · R ${formatPct(r.obligations.recall)}`} />
        <Gauge label="Regulations F1" value={r.regulations.f1} hint={`P ${formatPct(r.regulations.precision)} · R ${formatPct(r.regulations.recall)}`} color="var(--chart-2)" />
        <Gauge label="Raw citation validity" value={r.citations.validity_rate_raw} hint={`${r.citations.invalid_stripped} hallucinated stripped → 100% after guardrail`} color="var(--risk-medium)" />
        <Gauge label="Routed to human" value={r.routing.pct_routed} hint={`${r.routing.routed_to_human} decisions`} color="var(--risk-low)" />
      </m.div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Flagging breakdown</CardTitle>
            <CardDescription>Did a transaction that should fire a rule actually fire one?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2" role="table" aria-label="Confusion matrix">
              {cells.map((cell, i) => (
                <m.div
                  key={cell.k}
                  role="cell"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + i * 0.08 }}
                  className={cn("relative overflow-hidden rounded-xl border p-4", cell.good ? "border-risk-low/30" : "border-risk-high/30")}
                >
                  <m.div
                    aria-hidden
                    className={cn("absolute inset-0 origin-bottom", cell.good ? "bg-risk-low-bg" : "bg-risk-high-bg")}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: Math.max(0.08, cell.v / maxCell) }}
                    transition={{ duration: 0.9, delay: 0.3 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  />
                  <div className="relative">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {cell.good ? <CheckCircle2 className="size-3.5 text-risk-low" /> : <XCircle className="size-3.5 text-risk-high" />}
                      {cell.label}
                    </div>
                    <div className="mt-1 font-mono text-3xl font-semibold"><NumberTicker value={cell.v} /></div>
                  </div>
                </m.div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-border p-3 text-xs text-muted-foreground">
              <Timer className="size-4 text-brand" /> Latency per transaction: mean <span className="font-mono text-foreground">{r.latency_ms.mean} ms</span> · p95 <span className="font-mono text-foreground">{r.latency_ms.p95} ms</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Per rule</CardTitle>
            <CardDescription>F1 per deterministic rule, plus exact-match detection of every planted scenario</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {Object.entries(r.per_rule).map(([id, mtr], i) => (
              <div key={id} className="flex items-center gap-3">
                <RuleChip id={id} className="w-56 shrink-0 justify-start" />
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <m.div className="h-full origin-left rounded-full bg-chart-1" initial={{ scaleX: 0 }} animate={{ scaleX: mtr.f1 }} transition={{ duration: 0.9, delay: 0.2 + i * 0.05, ease: [0.22, 1, 0.36, 1] }} />
                </div>
                <span className="w-24 shrink-0 text-right font-mono text-xs">F1 {mtr.f1.toFixed(2)} · {mtr.tp}/{mtr.tp + mtr.fn}</span>
              </div>
            ))}
            <div className="grid grid-cols-1 gap-2 pt-4 sm:grid-cols-2">
              {Object.entries(r.scenarios).map(([name, s]) => (
                <div key={name} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                  {s.detected === s.transactions ? <CheckCircle2 className="size-3.5 text-risk-low" aria-label="all detected" /> : <XCircle className="size-3.5 text-risk-high" aria-label="some missed" />}
                  <span className="truncate">{name.replaceAll("_", " ")}</span>
                  <span className="ml-auto font-mono text-muted-foreground">{s.detected}/{s.transactions}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
