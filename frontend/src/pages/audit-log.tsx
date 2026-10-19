import { AnimatePresence, m } from "motion/react";
import { Check, ChevronRight, Link2, ShieldCheck, ShieldX, Skull, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api, type AuditEntry, type ChainReport } from "@/api/client";
import { useAudit } from "@/api/hooks";
import { RowsSkeleton } from "@/components/app/page-skeleton";
import { ErrorState, PageHeader } from "@/components/app/states";
import { ShimmerButton } from "@/components/magic/shimmer-button";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { formatDateTime, shortHash } from "@/lib/format";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

const VISIBLE = 18;
type BlockState = "idle" | "ok" | "bad" | "after";

function Block({ e, state, index }: { e: AuditEntry; state: BlockState; index: number }) {
  return (
    <div className="flex shrink-0 items-center">
      {index > 0 && (
        <m.div
          className={cn("h-0.5 w-6 origin-left", state === "ok" ? "bg-risk-low" : state === "bad" || state === "after" ? "bg-risk-high" : "bg-border-strong")}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: index * 0.03 }}
        />
      )}
      <m.div
        initial={{ opacity: 0, y: 14, scale: 0.9 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: state === "bad" ? [1, 1.08, 1] : 1,
          rotate: state === "bad" ? [0, -3, 3, -2, 0] : 0,
        }}
        transition={{ ...spring.gentle, delay: state === "idle" ? index * 0.03 : 0 }}
        className={cn(
          "relative w-36 rounded-xl border bg-card/90 p-2.5 text-left shadow-soft backdrop-blur transition-colors duration-300",
          state === "ok" && "border-risk-low/60 shadow-[0_0_24px_-8px_var(--risk-low)]",
          state === "bad" && "border-risk-high shadow-[0_0_30px_-6px_var(--risk-high)]",
          state === "after" && "border-risk-high/50 opacity-80",
          state === "idle" && "border-border",
        )}
        aria-label={`Block ${e.id} ${e.event_type} ${state === "idle" ? "" : state === "ok" ? "verified" : "broken"}`}
      >
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-muted-foreground">#{e.id}</span>
          <AnimatePresence mode="wait">
            {state !== "idle" && (
              <m.span key={state} initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={spring.bouncy}
                className={cn("grid size-4 place-items-center rounded-full", state === "ok" ? "bg-risk-low text-black" : "bg-risk-high text-white")}>
                {state === "ok" ? <Check className="size-2.5" /> : <X className="size-2.5" />}
              </m.span>
            )}
          </AnimatePresence>
        </div>
        <div className="mt-1 truncate text-[11px] font-semibold">{e.event_type.replaceAll("_", " ")}</div>
        <div className="mt-1 truncate font-mono text-[9.5px] text-muted-foreground">prev {shortHash(e.prev_hash, 4)}</div>
        <div className="truncate font-mono text-[9.5px]">hash {shortHash(e.hash, 4)}</div>
      </m.div>
    </div>
  );
}

export default function AuditLog() {
  const { data, error, isLoading, refetch } = useAudit();
  const [report, setReport] = useState<ChainReport | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Show the most recent blocks, oldest → newest.
  const blocks = useMemo(() => (data?.items ?? []).slice(0, VISIBLE).reverse(), [data]);
  const statusById = useMemo(() => new Map(report?.blocks.map((b) => [b.id, b]) ?? []), [report]);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const animateReport = (r: ChainReport) => {
    if (timer.current) clearInterval(timer.current);
    setReport(r);
    setRevealed(0);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let i = 0;
    timer.current = setInterval(() => {
      i += 1;
      setRevealed(i);
      const el = scroller.current?.children[Math.min(i, blocks.length) - 1] as HTMLElement | undefined;
      el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", inline: "center", block: "nearest" });
      if (i >= blocks.length && timer.current) clearInterval(timer.current);
    }, reduce ? 1 : 110);
  };

  const verify = async () => {
    setBusy(true);
    try {
      const r = await api.verify();
      animateReport(r);
      setTimeout(() => (r.valid ? toast.success(`Chain intact — ${r.checked} blocks verified`) : toast.error(`Chain broken at block #${r.broken_at}`)), blocks.length * 110);
    } finally {
      setBusy(false);
    }
  };

  const tamper = async () => {
    if (!blocks.length) return;
    setBusy(true);
    try {
      const target = blocks[Math.floor(blocks.length / 2)];
      const r = await api.simulateTamper(target.id);
      animateReport(r);
      setTimeout(() => toast.error(`Simulated edit to block #${target.id} detected`, { description: "Every later block now fails verification. The real log was not modified." }), blocks.length * 110);
    } finally {
      setBusy(false);
    }
  };

  const stateFor = (e: AuditEntry, idx: number): BlockState => {
    if (!report || idx >= revealed) return "idle";
    const b = statusById.get(e.id);
    if (!b) return "idle";
    if (b.valid) return "ok";
    return b.reason === "after break" ? "after" : "bad";
  };

  return (
    <div>
      <PageHeader
        eyebrow="Tamper-evident"
        title="Audit log"
        description="Every analysis, review and knowledge-base change is appended to a SHA-256 hash chain. Editing any historic entry breaks its hash and every link after it."
        actions={
          <>
            <button onClick={tamper} disabled={busy || !blocks.length} className="inline-flex h-9 items-center gap-2 rounded-lg border border-risk-high/40 px-3 text-sm text-risk-high transition-colors hover:bg-risk-high-bg disabled:opacity-50">
              <Skull className="size-4" /> Simulate tampering
            </button>
            <ShimmerButton onClick={verify} disabled={busy} className="py-2 text-sm">
              <ShieldCheck className="size-4" /> Verify integrity
            </ShimmerButton>
          </>
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <RowsSkeleton rows={8} />
      ) : (
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Link2 className="size-4 text-brand" /> Chain head · latest {blocks.length} of {data?.total} blocks</CardTitle>
                <CardDescription>hashₙ = SHA-256(prev_hash ‖ timestamp ‖ event ‖ entity ‖ actor ‖ payload)</CardDescription>
              </div>
              <AnimatePresence mode="wait">
                {report && revealed >= blocks.length && (
                  <m.div key={String(report.valid) + report.simulated} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={spring.bouncy}>
                    {report.valid ? (
                      <Badge variant="low" className="px-3 py-1 text-xs"><ShieldCheck /> {report.checked} blocks verified</Badge>
                    ) : (
                      <Badge variant="high" className="px-3 py-1 text-xs"><ShieldX /> broken at #{report.broken_at}{report.simulated && " (simulated)"}</Badge>
                    )}
                  </m.div>
                )}
              </AnimatePresence>
            </CardHeader>
            <CardContent>
              <div ref={scroller} className="flex overflow-x-auto pb-3 pt-1 mask-fade-x">
                {blocks.map((e, i) => <Block key={e.id} e={e} index={i} state={stateFor(e, i)} />)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Entries</CardTitle>
              <CardDescription>Newest first · click to inspect the canonical payload that was hashed</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {(data?.items ?? []).slice(0, 120).map((e) => (
                  <li key={e.id}>
                    <button onClick={() => setOpen(open === e.id ? null : e.id)} className="flex w-full items-center gap-3 py-2.5 text-left text-sm" aria-expanded={open === e.id}>
                      <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open === e.id && "rotate-90")} />
                      <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">#{e.id}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{e.event_type}</span>
                      <span className="hidden truncate text-xs text-muted-foreground sm:block">{e.entity_type} {e.entity_id}</span>
                      <span className="hidden w-20 shrink-0 truncate text-xs text-muted-foreground md:block">{e.actor}</span>
                      <span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground lg:block">{shortHash(e.hash, 6)}</span>
                      <span className="hidden shrink-0 text-xs text-muted-foreground md:block">{formatDateTime(e.timestamp)}</span>
                    </button>
                    <AnimatePresence>
                      {open === e.id && (
                        <m.pre initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-3 max-h-64 overflow-auto rounded-lg bg-muted p-3 font-mono text-[11px] leading-relaxed">
                          {JSON.stringify(JSON.parse(e.payload), null, 2)}
                          {"\n\n"}prev_hash: {e.prev_hash}{"\n"}hash:      {e.hash}
                        </m.pre>
                      )}
                    </AnimatePresence>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
