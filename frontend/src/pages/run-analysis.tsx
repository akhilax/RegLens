import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, m } from "motion/react";
import { Activity, ArrowRight, Database, Download, Radio, Zap } from "lucide-react";
import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { api } from "@/api/client";
import { useEventStream } from "@/api/hooks";
import { RiskBadge, RuleChip } from "@/components/app/badges";
import { PageHeader } from "@/components/app/states";
import { AnimatedList } from "@/components/magic/animated-list";
import { BorderBeam } from "@/components/magic/border-beam";
import { CircularProgress } from "@/components/magic/circular-progress";
import { FileUpload } from "@/components/magic/file-upload";
import { ShimmerButton } from "@/components/magic/shimmer-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { formatINR, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface RunEvent {
  type: "started" | "progress" | "decision" | "done" | "error";
  seq?: number;
  total?: number;
  processed?: number;
  flagged?: number;
  provider?: string;
  skipped_reviewed?: number;
  decision_id?: number;
  transaction_id?: string;
  amount_inr?: number;
  channel?: string;
  direction?: string;
  status?: string;
  risk_level?: string;
  rules?: string[];
  citation_issue?: boolean;
  requires_four_eyes?: boolean;
  message?: string;
}

export default function RunAnalysis() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [runId, setRunId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0, flagged: 0, provider: "", skipped: 0 });
  const [feed, setFeed] = useState<RunEvent[]>([]);
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");

  const onEvent = useCallback(
    (e: RunEvent) => {
      if (e.type === "started") {
        setProgress({ processed: 0, total: e.total ?? 0, flagged: 0, provider: e.provider ?? "", skipped: e.skipped_reviewed ?? 0 });
      } else if (e.type === "progress") {
        setProgress((p) => ({ ...p, processed: e.processed ?? p.processed, total: e.total ?? p.total, flagged: e.flagged ?? p.flagged }));
      } else if (e.type === "decision") {
        setFeed((f) => [e, ...f].slice(0, 60));
        setProgress((p) => ({ ...p, flagged: p.flagged + 1 }));
      } else if (e.type === "done") {
        setPhase("done");
        setProgress((p) => ({ ...p, processed: e.processed ?? p.total, total: e.total ?? p.total, flagged: e.flagged ?? p.flagged }));
        qc.invalidateQueries();
        toast.success("Analysis complete", {
          description: `${e.flagged} flagged of ${e.processed} analysed`,
          action: { label: "Review queue", onClick: () => navigate("/app/review") },
        });
      } else if (e.type === "error") {
        setPhase("error");
        toast.error("Analysis failed", { description: e.message });
      }
    },
    [qc, navigate],
  );
  useEventStream<RunEvent>(runId ? api.sseUrl(`/analysis/runs/${runId}/events`) : null, onEvent);

  const begin = (id: number) => {
    setFeed([]);
    setProgress({ processed: 0, total: 0, flagged: 0, provider: "", skipped: 0 });
    setPhase("running");
    setRunId(id);
  };

  const startSynthetic = async () => {
    setStarting(true);
    try {
      const run = await api.startRun();
      begin(run.id);
    } catch (err) {
      toast.error("Could not start analysis", { description: String(err) });
    } finally {
      setStarting(false);
    }
  };

  const upload = async (file: File) => {
    setStarting(true);
    try {
      const res = await api.uploadCsv(file);
      if (res.errors.length) toast.warning(`${res.errors.length} row(s) skipped`, { description: res.errors.slice(0, 3).join(" · ") });
      if (res.run_id) {
        toast.success(`Uploaded ${res.inserted} transaction(s)`);
        begin(res.run_id);
      }
    } catch (err) {
      toast.error("Upload failed", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setStarting(false);
    }
  };

  const pct = progress.total ? progress.processed / progress.total : phase === "done" ? 1 : 0;
  const running = phase === "running";

  return (
    <div>
      <PageHeader
        eyebrow="Pipeline"
        title="Run analysis"
        description="Every transaction goes through rules → hybrid retrieval → LLM → citation guardrail → routing. Progress streams live over Server-Sent Events."
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="size-4 text-brand" /> Synthetic dataset</CardTitle>
              <CardDescription>600 transactions over 3 months with planted structuring, PEP, LRS, NPO and high-risk-jurisdiction scenarios. Reviewed decisions are kept.</CardDescription>
            </CardHeader>
            <CardContent>
              <ShimmerButton onClick={startSynthetic} disabled={starting || running} className="w-full">
                <Zap className="size-4" /> {running ? "Analysing…" : "Analyse all transactions"}
              </ShimmerButton>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="size-4 text-brand" /> Upload your own CSV</CardTitle>
              <CardDescription>Columns: account_id, timestamp, amount_inr, channel, direction (+ optional counterparty_country, purpose_code).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <FileUpload accept=".csv,text/csv" onFile={upload} disabled={starting || running} title="Drag & drop a CSV, or click to browse" hint="Rows must reference existing accounts (A0001–A0068)" />
              <Button variant="link" size="sm" asChild className="h-auto px-0">
                <a href="/sample-transactions.csv" download>
                  <Download /> Download sample CSV (7 rows, 3 planted alerts)
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden">
          {running && <BorderBeam size={160} duration={6} />}
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Radio className={cn("size-4", running ? "animate-pulse text-risk-high" : "text-muted-foreground")} /> Live feed
              </CardTitle>
              <CardDescription>{progress.provider ? <span className="font-mono">{progress.provider}</span> : "Start a run to stream decisions as they’re made."}</CardDescription>
            </div>
            {phase === "done" && (
              <Button size="sm" asChild>
                <Link to="/app/review">Review queue <ArrowRight /></Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="mb-6 flex flex-col items-center gap-6 sm:flex-row">
              <CircularProgress value={pct} label="Analysis progress" size={168} color={phase === "done" ? "var(--risk-low)" : "var(--brand)"}>
                <div>
                  <div className="font-mono text-3xl font-semibold tabular">{Math.round(pct * 100)}%</div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatNumber(progress.processed)} / {formatNumber(progress.total)}
                  </div>
                </div>
              </CircularProgress>
              <div className="grid w-full flex-1 grid-cols-3 gap-3">
                {[
                  ["Processed", progress.processed],
                  ["Flagged", progress.flagged],
                  ["Kept (reviewed)", progress.skipped],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-border bg-background/40 p-3">
                    <div className="text-[11px] text-muted-foreground">{k}</div>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <m.div key={String(v)} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} className="font-mono text-xl font-semibold tabular">
                        {formatNumber(Number(v))}
                      </m.div>
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>
            <div className="h-[420px] overflow-y-auto pr-1 mask-fade-b">
              {feed.length === 0 ? (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">{running ? "Waiting for the first flagged transaction…" : "Flagged transactions will appear here in real time."}</div>
              ) : (
                <AnimatedList
                  items={feed.map((e) => ({
                    key: `${e.decision_id}`,
                    node: (
                      <Link to={`/app/decisions/${e.decision_id}`} className="flex items-center gap-3 rounded-xl border border-border bg-card/70 p-3 transition-colors hover:border-border-strong hover:bg-accent/30">
                        <div className={cn("grid size-9 shrink-0 place-items-center rounded-lg", e.risk_level === "high" ? "bg-risk-high-bg" : e.risk_level === "medium" ? "bg-risk-medium-bg" : "bg-risk-low-bg")}>
                          <Zap className={cn("size-4", e.risk_level === "high" ? "text-risk-high" : e.risk_level === "medium" ? "text-risk-medium" : "text-risk-low")} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs">{e.transaction_id}</span>
                            <span className="font-mono text-sm font-semibold">{formatINR(e.amount_inr ?? 0)}</span>
                            <span className="text-xs text-muted-foreground">{e.channel} {e.direction}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {e.rules?.map((r) => <RuleChip key={r} id={r} />)}
                            {e.citation_issue && <span className="rounded-md bg-risk-high-bg px-1.5 py-0.5 text-[10.5px] text-risk-high">guardrail</span>}
                            {e.requires_four_eyes && <span className="rounded-md bg-accent px-1.5 py-0.5 text-[10.5px] text-accent-foreground">four-eyes</span>}
                          </div>
                        </div>
                        <RiskBadge level={e.risk_level} />
                      </Link>
                    ),
                  }))}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
