import { m } from "motion/react";
import { Activity, ArrowRight, CalendarClock, ClipboardCheck, ShieldAlert, ShieldCheck, Siren, Sparkles } from "lucide-react";
import { lazy, Suspense } from "react";
import { Link } from "react-router";
import { useStats } from "@/api/hooks";
import { PageSkeleton } from "@/components/app/page-skeleton";
import { ErrorState, PageHeader } from "@/components/app/states";
import { Ripple } from "@/components/magic/backgrounds";
import { BentoCard, BentoGrid } from "@/components/magic/bento-grid";
import { BorderBeam } from "@/components/magic/border-beam";
import { NumberTicker } from "@/components/magic/number-ticker";
import { Timeline } from "@/components/magic/timeline";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/primitives";
import { countdownLabel, daysUntil, formatDate, formatINRCompact, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const ActivityChart = lazy(() => import("@/components/charts/dashboard-charts").then((m) => ({ default: m.ActivityChart })));
const RuleChart = lazy(() => import("@/components/charts/dashboard-charts").then((m) => ({ default: m.RuleChart })));

function Kpi({ label, value, icon: Icon, hint, format, tone = "brand" }: {
  label: string;
  value: number;
  icon: typeof Activity;
  hint: string;
  format?: (n: number) => string;
  tone?: "brand" | "high" | "medium" | "low";
}) {
  const toneCls = { brand: "text-brand", high: "text-risk-high", medium: "text-risk-medium", low: "text-risk-low" }[tone];
  return (
    <div className="flex h-full flex-col justify-between gap-3 p-4 sm:gap-4 sm:p-5">
      <div className="flex items-start justify-between gap-2 text-xs text-muted-foreground">
        <span>{label}</span>
        <Icon className={cn("size-4", toneCls)} aria-hidden />
      </div>
      <div>
        <div className="text-2xl font-semibold tracking-tight sm:text-3xl">
          <NumberTicker value={value} format={format ?? formatNumber} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: s, error, refetch, isLoading } = useStats();
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading || !s) return <PageSkeleton />;

  const openReview = s.pending_review + s.in_review + s.awaiting_second_approval;
  const highOpen = s.risk_distribution.high ?? 0;
  const pulse = openReview === 0 ? "calm" : highOpen > 5 ? "elevated" : "watch";
  const pulseColor = pulse === "calm" ? "var(--risk-low)" : pulse === "watch" ? "var(--risk-medium)" : "var(--risk-high)";
  const risk = { low: s.risk_distribution.low ?? 0, medium: s.risk_distribution.medium ?? 0, high: s.risk_distribution.high ?? 0 };
  const total = Math.max(1, risk.low + risk.medium + risk.high);
  const lastRun = s.last_run as { id: number; processed: number; flagged: number; provider: string } | null;

  return (
    <div>
      <PageHeader
        eyebrow="Compliance overview"
        title="Good to see you. Here’s today’s exposure."
        description={`${formatNumber(s.transactions)} transactions · ${formatINRCompact(s.volume_inr)} volume`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/app/analysis"><Activity /> Run analysis</Link>
            </Button>
            <Button asChild>
              <Link to="/app/review"><ClipboardCheck /> Review queue <span className="rounded bg-white/20 px-1.5 text-xs">{openReview}</span></Link>
            </Button>
          </>
        }
      />

      <BentoGrid className="auto-rows-auto grid-cols-2 gap-3 sm:gap-4 md:grid-cols-12">
        <BentoCard className="md:col-span-3">
          <Kpi label="Transactions analysed" value={s.analyzed} icon={Activity} hint={`of ${formatNumber(s.transactions)} ingested`} />
        </BentoCard>
        <BentoCard className="md:col-span-3">
          <Kpi label="Flagged by rules" value={s.flagged} icon={Siren} tone="high" hint={`${formatINRCompact(s.flagged_volume_inr)} flagged volume`} />
        </BentoCard>
        <BentoCard className="md:col-span-3">
          <Kpi label="Awaiting human review" value={openReview} icon={ClipboardCheck} tone="medium" hint={`${s.awaiting_second_approval} need a second approver`} />
        </BentoCard>
        <BentoCard className="md:col-span-3">
          <Kpi label="Hallucinations blocked" value={s.hallucinations_blocked} icon={ShieldAlert} tone="low" hint={`${s.citation_issues} decisions had a citation issue`} />
        </BentoCard>

        <BentoCard className="col-span-2 md:col-span-8">
          <div className="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Activity</h2>
                <p className="text-xs text-muted-foreground">Weekly transactions vs. rule-flagged</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-chart-1" />Transactions</span>
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-chart-2" />Flagged</span>
              </div>
            </div>
            <Suspense fallback={<Skeleton className="h-56" />}>
              <ActivityChart daily={s.daily} />
            </Suspense>
          </div>
        </BentoCard>

        <BentoCard className="col-span-2 md:col-span-4">
          <div className="relative flex h-full min-h-64 flex-col overflow-hidden p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Risk pulse</h2>
              <span className="flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] capitalize" style={{ color: pulseColor }}>
                {pulse === "calm" ? <ShieldCheck className="size-3" /> : <Siren className="size-3" />} {pulse}
              </span>
            </div>
            <div className="relative my-2 flex-1">
              <Ripple color={pulseColor} rings={6} base={56} step={30} />
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <div className="text-4xl font-semibold tracking-tight" style={{ color: pulseColor }}>
                    <NumberTicker value={openReview} />
                  </div>
                  <div className="text-[11px] text-muted-foreground">open decisions</div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Risk mix: ${risk.high} high, ${risk.medium} medium, ${risk.low} low`}>
                {(["high", "medium", "low"] as const).map((k, i) => (
                  <m.div
                    key={k}
                    className={cn("h-full", i > 0 && "border-l-2 border-card", { high: "bg-risk-high", medium: "bg-risk-medium", low: "bg-risk-low" }[k])}
                    initial={{ width: 0 }}
                    animate={{ width: `${(risk[k] / total) * 100}%` }}
                    transition={{ duration: 1, delay: 0.3 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Siren className="size-3 text-risk-high" />{risk.high} high</span>
                <span>{risk.medium} medium</span>
                <span className="flex items-center gap-1"><ShieldCheck className="size-3 text-risk-low" />{risk.low} low</span>
              </div>
            </div>
          </div>
        </BentoCard>

        <BentoCard className="col-span-2 md:col-span-5">
          <div className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Upcoming filing deadlines</h2>
                <p className="text-xs text-muted-foreground">FIU-IND reports from open and approved decisions</p>
              </div>
              <CalendarClock className="size-4 text-brand" aria-hidden />
            </div>
            {s.upcoming_deadlines.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No reporting deadlines — nice.</p>
            ) : (
              <Timeline
                items={s.upcoming_deadlines.slice(0, 7).map((d) => {
                  const days = daysUntil(d.deadline);
                  const tone = days < 0 ? "high" : days <= 7 ? "medium" : "brand";
                  return {
                    key: `${d.decision_id}-${d.type}`,
                    tone,
                    content: (
                      <Link to={`/app/decisions/${d.decision_id}`} className="group flex items-center gap-3 rounded-lg py-0.5">
                        <span className="w-14 shrink-0 font-mono text-xs font-semibold">{d.type}</span>
                        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground group-hover:text-foreground">
                          {d.transaction_id} · due {formatDate(d.deadline, { day: "2-digit", month: "short" })}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 font-mono text-[10.5px]",
                            tone === "high" ? "bg-risk-high-bg text-risk-high" : tone === "medium" ? "bg-risk-medium-bg text-risk-medium" : "bg-accent text-accent-foreground",
                          )}
                        >
                          {countdownLabel(d.deadline)}
                        </span>
                      </Link>
                    ),
                  };
                })}
              />
            )}
          </div>
        </BentoCard>

        <BentoCard className="col-span-2 md:col-span-4">
          <div className="p-5">
            <h2 className="text-sm font-semibold">Rule hits</h2>
            <p className="mb-3 text-xs text-muted-foreground">Which deterministic rules fired</p>
            <Suspense fallback={<Skeleton className="h-48" />}>
              <RuleChart byRule={s.by_rule} />
            </Suspense>
          </div>
        </BentoCard>

        <BentoCard className="col-span-2 md:col-span-3">
          <div className="relative flex h-full flex-col justify-between gap-4 overflow-hidden rounded-2xl p-5">
            <BorderBeam size={90} duration={7} />
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="size-4 text-brand" /> Last analysis run
              </div>
              {lastRun ? (
                <>
                  <div className="mt-3 font-mono text-2xl font-semibold">#{lastRun.id}</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {lastRun.processed} processed · {lastRun.flagged} flagged
                  </p>
                  <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{lastRun.provider}</p>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No runs yet.</p>
              )}
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Approved</span>
                <span className="font-mono">{s.approved}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Rejected</span>
                <span className="font-mono">{s.rejected}</span>
              </div>
              <Button variant="secondary" size="sm" className="mt-2 w-full" asChild>
                <Link to="/app/analysis">Open live analysis <ArrowRight /></Link>
              </Button>
            </div>
          </div>
        </BentoCard>
      </BentoGrid>
    </div>
  );
}
