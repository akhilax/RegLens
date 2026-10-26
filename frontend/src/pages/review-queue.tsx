import confetti from "canvas-confetti";
import { AnimatePresence, LayoutGroup, m } from "motion/react";
import { AlertTriangle, Check, Download, FileDown, ShieldAlert, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { api, type DecisionSummary } from "@/api/client";
import { useMeta, useQueue, useReports, useReviewAction } from "@/api/hooks";
import { RiskBadge, RuleChip, StatusBadge } from "@/components/app/badges";
import { HoldToApprove } from "@/components/app/hold-to-approve";
import { RowsSkeleton } from "@/components/app/page-skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/components/app/states";
import { Avatar } from "@/components/magic/animated-tooltip";
import { BorderBeam } from "@/components/magic/border-beam";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlay";
import { Kbd, Textarea } from "@/components/ui/primitives";
import { countdownLabel, formatDate, formatINR, OBLIGATION_LABEL, RULE_REASON } from "@/lib/format";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useUI } from "@/store/ui";

const COLUMNS = [
  { id: "pending", title: "Pending", states: ["pending_review"] },
  { id: "review", title: "In review", states: ["in_review", "awaiting_second_approval"] },
  { id: "approved", title: "Approved", states: ["approved"] },
  { id: "rejected", title: "Rejected", states: ["rejected"] },
] as const;

function celebrate() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  confetti({ particleCount: 70, spread: 70, startVelocity: 32, origin: { y: 0.7 }, colors: ["#8a63f5", "#2aa3c7", "#34d399", "#ffffff"], disableForReducedMotion: true });
}

function QueueCard({ d, selected, onOpen }: { d: DecisionSummary; selected: boolean; onOpen: () => void }) {
  const isStr = d.requires_four_eyes;
  return (
    <m.button
      layout
      layoutId={`card-${d.id}`}
      onClick={onOpen}
      transition={spring.gentle}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      data-selected={selected}
      className={cn(
        "relative w-full shrink-0 overflow-hidden rounded-xl border bg-card/80 p-3 text-left shadow-soft backdrop-blur-xl transition-colors",
        selected ? "border-brand ring-2 ring-brand/30" : "border-border hover:border-border-strong",
      )}
      aria-label={`Decision ${d.id} for ${d.transaction_id}, ${d.risk_level} risk, ${d.status}`}
    >
      {isStr && d.status !== "approved" && d.status !== "rejected" && <BorderBeam size={70} duration={6} colorFrom="var(--risk-high)" colorTo="var(--brand)" />}
      <m.div layout="position" className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-muted-foreground">#{d.id} · {d.transaction_id}</span>
        <RiskBadge level={d.risk_level} />
      </m.div>
      <m.div layout="position" className="mt-1.5 flex items-baseline gap-2">
        <span className="font-mono text-base font-semibold tabular">{formatINR(d.amount_inr)}</span>
        <span className="truncate text-[11px] text-muted-foreground">{d.channel} · {d.customer_type}</span>
      </m.div>
      <m.div layout="position" className="mt-2 flex flex-wrap gap-1">
        {d.rules.map((r) => <RuleChip key={r} id={r} className="[&>span:last-child]:hidden" />)}
      </m.div>
      <m.div layout="position" className="mt-2.5 flex items-center justify-between gap-2 text-[11px]">
        <span className="flex items-center gap-1 text-muted-foreground">
          {d.citation_issue && <ShieldAlert className="size-3 text-risk-high" aria-label="citation issue" />}
          {isStr && <Users className="size-3 text-brand" aria-label="four-eyes" />}
          {d.earliest_deadline ? countdownLabel(d.earliest_deadline) : "no deadline"}
        </span>
        {isStr && d.status === "awaiting_second_approval" && <span className="rounded bg-accent px-1.5 font-mono text-accent-foreground">1/2</span>}
      </m.div>
    </m.button>
  );
}

function DetailPanel({ d, onClose }: { d: DecisionSummary; onClose: () => void }) {
  const reviewer = useUI((s) => s.reviewer);
  const { data: meta } = useMeta();
  const mutation = useReviewAction();
  const [mode, setMode] = useState<"none" | "reject">("none");
  const [comment, setComment] = useState("");
  const [justApproved, setJustApproved] = useState(false);
  // Four-eyes: once someone has approved, the next approval is made by a different reviewer.
  const actorId = d.approvals.includes(reviewer)
    ? (meta?.reviewers.find((r) => !d.approvals.includes(r.id))?.id ?? reviewer)
    : reviewer;
  const me = meta?.reviewers.find((r) => r.id === actorId);
  const closed = d.status === "approved" || d.status === "rejected";
  const nextSteps = Object.values(
    d.obligations.reduce<Record<string, (typeof d.obligations)[number]>>((acc, o) => {
      const prev = acc[o.type];
      if (!prev || (o.deadline && (!prev.deadline || o.deadline < prev.deadline))) acc[o.type] = o;
      return acc;
    }, {}),
  );
  const alreadyApproved = d.approvals.includes(actorId);

  const run = (action: "approve" | "reject", extra: { comment?: string; modifications?: Record<string, unknown> } = {}) =>
    mutation.mutate(
      { id: d.id, body: { reviewer: actorId, action, comment: extra.comment ?? null, modifications: extra.modifications ?? null } },
      {
        onSuccess: (res) => {
          setMode("none");
          setComment("");
          if (res.status === "approved") {
            setJustApproved(true);
            celebrate();
            toast.success(`Decision #${d.id} approved`, { description: d.requires_four_eyes ? "Four-eyes complete — STR clock started" : undefined });
          } else if (res.status === "awaiting_second_approval") {
            toast("First approval recorded", { description: "A different reviewer must approve to complete four-eyes." });
          } else if (res.status === "rejected") {
            toast(`Decision #${d.id} rejected`);
          }
        },
      },
    );

  return (
    <m.div
      layoutId={`card-${d.id}`}
      transition={spring.gentle}
      className="relative overflow-hidden rounded-2xl border border-border-strong bg-popover p-5 shadow-lift sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Decision ${d.id}`}
    >
      <button onClick={onClose} className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close">
        <X className="size-4" />
      </button>
      <m.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.15 } }} className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 pr-8">
          <span className="font-mono text-xs text-muted-foreground">Decision #{d.id} · {d.transaction_id}</span>
          <RiskBadge level={d.risk_level} />
          <StatusBadge status={d.status} />
        </div>
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="font-mono text-3xl font-semibold tracking-tight">{formatINR(d.amount_inr)}</span>
          <span className="text-sm text-muted-foreground">{d.channel} {d.direction} · {d.customer_name} ({d.customer_type}) · {formatDate(d.timestamp)}</span>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Why it was flagged</h3>
          <ul className="space-y-1.5">
            {d.rules.map((r) => (
              <li key={r} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-risk-medium" aria-hidden />
                {RULE_REASON[r] ?? r}
              </li>
            ))}
            {d.citation_issue && (
              <li className="flex items-start gap-2 text-sm">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-risk-high" aria-hidden />
                The AI quoted a rule it couldn’t back up, so it was removed and a person must check.
              </li>
            )}
          </ul>
        </div>

        {nextSteps.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">What needs to happen</h3>
            <ul className="space-y-1.5">
              {nextSteps.map((o) => (
                <li key={o.type} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm">
                  <span>{OBLIGATION_LABEL[o.type] ?? o.type}</span>
                  {o.deadline ? (
                    <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 font-mono text-[10.5px] text-accent-foreground">{countdownLabel(o.deadline)}</span>
                  ) : (
                    <span className="shrink-0 text-[10.5px] text-muted-foreground">after approval</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {d.requires_four_eyes && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-accent/30 p-3">
            <Users className="size-5 text-brand" />
            <div className="flex-1 text-xs">
              <div className="font-medium">Four-eyes required (STR candidate)</div>
              <div className="text-muted-foreground">{d.approvals.length} of 2 approvals{d.approvals.length ? ` · approved by ${d.approvals.join(", ")}` : ""}</div>
            </div>
            <div className="flex">
              {[0, 1].map((i) => (
                <m.span key={i} initial={false} animate={{ scale: d.approvals[i] ? 1 : 0.85, opacity: d.approvals[i] ? 1 : 0.35 }} transition={spring.bouncy} className="-ml-1.5">
                  {d.approvals[i] ? <Avatar name={meta?.reviewers.find((r) => r.id === d.approvals[i])?.name ?? d.approvals[i]} idx={i} className="size-7" /> : <span className="grid size-7 place-items-center rounded-full border border-dashed border-border-strong text-[10px] text-muted-foreground">?</span>}
                </m.span>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {justApproved || d.status === "approved" ? (
            <m.div key="ok" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={spring.bouncy} className="flex items-center gap-3 rounded-xl border border-risk-low/30 bg-risk-low-bg p-3 text-sm text-risk-low">
              <m.span initial={{ rotate: -90, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ ...spring.bouncy, delay: 0.1 }} className="grid size-7 place-items-center rounded-full bg-risk-low text-black">
                <Check className="size-4" />
              </m.span>
              Approved — DRAFT reports now include this decision.
            </m.div>
          ) : closed ? (
            <m.p key="closed" className="text-sm text-muted-foreground">This decision is closed.</m.p>
          ) : mode !== "none" ? (
            <m.div key="form" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
              <Textarea autoFocus value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Why is this not reportable? (required)" aria-label="Reviewer comment" />
              <div className="flex gap-2">
                <Button variant="destructive" disabled={!comment.trim() || mutation.isPending} onClick={() => run("reject", { comment })}>
                  Confirm reject
                </Button>
                <Button variant="ghost" onClick={() => setMode("none")}>Cancel</Button>
              </div>
            </m.div>
          ) : (
            <m.div key="actions" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center gap-2">
              {d.requires_four_eyes ? (
                <HoldToApprove
                  disabled={mutation.isPending || alreadyApproved}
                  label={alreadyApproved ? "You already approved" : d.approvals.length ? "Hold for 2nd approval" : "Hold to approve STR"}
                  onConfirm={() => run("approve")}
                />
              ) : (
                <Button variant="success" onClick={() => run("approve")} disabled={mutation.isPending}>
                  <Check /> Approve <Kbd className="ml-1 border-black/20 bg-black/10 text-black/70">A</Kbd>
                </Button>
              )}
              <Button variant="ghost" className="text-risk-high" onClick={() => setMode("reject")}>
                <X /> Reject <Kbd className="ml-1">R</Kbd>
              </Button>
            </m.div>
          )}
        </AnimatePresence>
        <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
          <span>{d.approvals.length ? "Second approver" : "Approving as"} <span className="font-medium text-foreground">{me?.name ?? actorId}</span>{me ? ` · ${me.role}` : ""}</span>
        </div>
      </m.div>
    </m.div>
  );
}

export default function ReviewQueue() {
  const { data, error, isLoading, refetch } = useQueue();
  const { data: reports } = useReports();
  const mutation = useReviewAction();
  const reviewer = useUI((s) => s.reviewer);
  const [params] = useSearchParams();
  const [openId, setOpenId] = useState<number | null>(() => Number(params.get("open")) || null);
  const [cursor, setCursor] = useState(0);

  const columns = useMemo(
    () => COLUMNS.map((c) => ({ ...c, items: (data ?? []).filter((d) => (c.states as readonly string[]).includes(d.status)) })),
    [data],
  );
  const actionable = useMemo(() => [...columns[0].items, ...columns[1].items], [columns]);
  const selected = actionable[Math.min(cursor, Math.max(0, actionable.length - 1))];
  const open = data?.find((d) => d.id === openId) ?? null;

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=true]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "j") setCursor((c) => Math.min(c + 1, actionable.length - 1));
      else if (k === "k") setCursor((c) => Math.max(c - 1, 0));
      else if (k === "enter" && selected && !open) setOpenId(selected.id);
      else if (k === "escape") setOpenId(null);
      else if (k === "a" && selected) {
        if (selected.requires_four_eyes) {
          setOpenId(selected.id);
          toast("STR candidates need hold-to-approve", { description: "Press and hold the approve button (four-eyes)." });
        } else {
          mutation.mutate(
            { id: selected.id, body: { reviewer, action: "approve", comment: null, modifications: null } },
            { onSuccess: () => { celebrate(); toast.success(`Decision #${selected.id} approved`); } },
          );
        }
      } else if (k === "r" && selected) setOpenId(selected.id);
      else return;
      e.preventDefault();
    },
    [actionable.length, selected, open, mutation, reviewer],
  );
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  return (
    <div>
      <PageHeader
        eyebrow="Human in the loop"
        title="Review queue"
        description="Sorted by risk, then deadline. Nothing is reportable until a human approves it; STR candidates need two different reviewers."
        actions={
          <>
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex">
              <Kbd>J</Kbd><Kbd>K</Kbd> move · <Kbd>Enter</Kbd> open · <Kbd>A</Kbd> approve · <Kbd>R</Kbd> reject
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline"><FileDown /> DRAFT reports</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Generated from approved decisions only</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(reports ?? []).map((r) => (
                  <div key={r.type}>
                    <DropdownMenuItem asChild>
                      <a href={api.reportUrl(r.type, "csv")} download>
                        <Download className="size-4" /> {r.type} · CSV <span className="ml-auto font-mono text-xs text-muted-foreground">{r.approved_count}</span>
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={api.reportUrl(r.type, "md")} download>
                        <Download className="size-4" /> {r.type} · Markdown
                      </a>
                    </DropdownMenuItem>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{COLUMNS.map((c) => <RowsSkeleton key={c.id} rows={4} />)}</div>
      ) : !data?.length ? (
        <EmptyState title="The queue is empty" description="Run an analysis to route decisions here." action={<Button asChild><Link to="/app/analysis">Run analysis</Link></Button>} />
      ) : (
        <LayoutGroup>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {columns.map((col) => (
              <section key={col.id} aria-label={col.title} className="flex min-h-40 flex-col rounded-2xl border border-border bg-card/30 p-2.5">
                <header className="mb-2 flex items-center justify-between px-1.5 py-1">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{col.title}</h2>
                  <m.span key={col.items.length} initial={{ scale: 1.4 }} animate={{ scale: 1 }} transition={spring.bouncy} className="rounded-full bg-muted px-2 font-mono text-[11px]">
                    {col.items.length}
                  </m.span>
                </header>
                <div className="flex max-h-[calc(100dvh-300px)] flex-col gap-2 overflow-y-auto p-0.5">
                  {col.items.map((d) =>
                    openId === d.id ? (
                      <div key={d.id} aria-hidden className="h-[124px] shrink-0 rounded-xl border border-dashed border-border-strong" />
                    ) : (
                      <QueueCard key={d.id} d={d} selected={selected?.id === d.id} onOpen={() => setOpenId(d.id)} />
                    ),
                  )}
                  {col.items.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Nothing here</p>}
                </div>
              </section>
            ))}
          </div>

          <AnimatePresence>
            {open && (
              <>
                <m.div key="backdrop" className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpenId(null)} />
                <div key="panel" className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4" onClick={(e) => e.target === e.currentTarget && setOpenId(null)}>
                  <div className="w-full max-w-2xl">
                    <DetailPanel d={open} onClose={() => setOpenId(null)} />
                  </div>
                </div>
              </>
            )}
          </AnimatePresence>
        </LayoutGroup>
      )}
    </div>
  );
}
