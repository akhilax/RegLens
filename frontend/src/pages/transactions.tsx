import { createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AnimatePresence, m } from "motion/react";
import { ArrowDownLeft, ArrowUpDown, ArrowUpRight, ExternalLink, Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { Transaction } from "@/api/client";
import { useTransactions } from "@/api/hooks";
import { RiskBadge, RuleChip, StatusBadge } from "@/components/app/badges";
import { RowsSkeleton } from "@/components/app/page-skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/overlay";
import { Card, Input } from "@/components/ui/primitives";
import { formatDateTime, formatINR, formatNumber } from "@/lib/format";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

const col = createColumnHelper<Transaction>();
const CHANNELS = ["all", "cash", "UPI", "IMPS", "NEFT", "RTGS", "SWIFT", "card"];
const RISKS = ["all", "high", "medium", "low"];

function Segmented({ value, options, onChange, label, id }: { value: string; options: string[]; onChange: (v: string) => void; label: string; id: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-xl border border-border bg-card/50 p-1">
      {options.map((o) => (
        <button
          key={o}
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={cn("relative rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors", value === o ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {value === o && <m.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-lg bg-accent shadow-soft" transition={spring.snappy} />}
          <span className="relative">{o}</span>
        </button>
      ))}
    </div>
  );
}

export default function Transactions() {
  const [params, setParams] = useSearchParams();
  const [channel, setChannel] = useState("all");
  const [risk, setRisk] = useState("all");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [q, setQ] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "timestamp", desc: true }]);
  const focus = params.get("focus");

  const query = useTransactions({ page_size: 1000 });
  const all = query.data?.items;
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (all ?? []).filter(
      (t) =>
        (channel === "all" || t.channel === channel) &&
        (risk === "all" || t.risk_level === risk) &&
        (!flaggedOnly || (t.rules?.length ?? 0) > 0) &&
        (!needle || `${t.id} ${t.account_id} ${t.customer_name} ${t.counterparty_country}`.toLowerCase().includes(needle)),
    );
  }, [all, channel, risk, flaggedOnly, q]);

  const columns = useMemo(
    () => [
      col.accessor("id", { header: "Txn", cell: (c) => <span className="font-mono text-xs">{c.getValue()}</span>, size: 90 }),
      col.accessor("timestamp", { header: "Time", cell: (c) => <span className="text-xs text-muted-foreground">{formatDateTime(c.getValue())}</span>, size: 130 }),
      col.accessor("customer_name", {
        header: "Customer",
        cell: (c) => (
          <div className="min-w-0">
            <div className="truncate text-sm">{c.getValue()}</div>
            <div className="truncate font-mono text-[11px] text-muted-foreground">{c.row.original.account_masked} · {c.row.original.customer_type}</div>
          </div>
        ),
        size: 220,
      }),
      col.accessor("channel", {
        header: "Channel",
        cell: (c) => (
          <span className="inline-flex items-center gap-1.5 text-xs">
            {c.row.original.direction === "credit" ? <ArrowDownLeft className="size-3.5 text-risk-low" aria-label="credit" /> : <ArrowUpRight className="size-3.5 text-muted-foreground" aria-label="debit" />}
            {c.getValue()}
            {c.row.original.counterparty_country !== "IN" && <span className="rounded bg-muted px-1 font-mono text-[10px]">{c.row.original.counterparty_country}</span>}
          </span>
        ),
        size: 110,
      }),
      col.accessor("amount_inr", {
        header: () => <span className="block text-right">Amount</span>,
        cell: (c) => <span className="block text-right font-mono text-sm tabular">{formatINR(c.getValue())}</span>,
        size: 130,
      }),
      col.accessor("rules", {
        header: "Rules",
        enableSorting: false,
        cell: (c) => (
          <div className="flex flex-wrap gap-1">
            {c.getValue()?.length ? c.getValue()!.map((r) => <RuleChip key={r} id={r} className="[&>span:last-child]:hidden" />) : <span className="text-xs text-muted-foreground">—</span>}
          </div>
        ),
        size: 190,
      }),
      col.accessor("risk_level", { header: "Risk", cell: (c) => (c.getValue() ? <RiskBadge level={c.getValue()} /> : null), size: 90 }),
      col.accessor("decision_status", { header: "Status", cell: (c) => (c.getValue() ? <StatusBadge status={c.getValue()!} /> : null), size: 160 }),
    ],
    [],
  );

  // TanStack Table returns non-memoisable functions by design; the React Compiler lint rule is not applicable here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const tableRows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({ count: tableRows.length, getScrollElement: () => scrollRef.current, estimateSize: () => 56, overscan: 12 });
  const focused = all?.find((t) => t.id === focus) ?? null;
  const gridTemplate = columns.map((c) => `minmax(${c.size ?? 100}px, ${c.size ?? 100}fr)`).join(" ");

  return (
    <div>
      <PageHeader
        eyebrow="Ledger"
        title="Transactions"
        description="Every transaction with its current decision. Virtualised, so it stays smooth at any size."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ID, account, name, country" className="pl-9" aria-label="Search transactions" />
        </div>
        <Segmented id="channel" label="Channel" value={channel} options={CHANNELS} onChange={setChannel} />
        <Segmented id="risk" label="Risk" value={risk} options={RISKS} onChange={setRisk} />
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
          Flagged only
        </label>
        <m.span key={rows.length} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="ml-auto text-xs text-muted-foreground">
          {formatNumber(rows.length)} of {formatNumber(all?.length ?? 0)}
        </m.span>
      </div>

      {query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <RowsSkeleton rows={10} />
      ) : rows.length === 0 ? (
        <EmptyState title="No transactions match these filters" description="Try clearing a filter or the search box." action={<Button variant="outline" size="sm" onClick={() => { setChannel("all"); setRisk("all"); setQ(""); setFlaggedOnly(false); }}><X /> Clear filters</Button>} />
      ) : (
        <Card className="overflow-hidden">
          <div ref={scrollRef} className="h-[calc(100dvh-280px)] min-h-96 overflow-auto" role="table" aria-rowcount={tableRows.length} aria-label="Transactions">
            <div className="min-w-[1100px]">
              <div role="rowgroup" className="glass sticky top-0 z-10 border-b border-border">
                {table.getHeaderGroups().map((hg) => (
                  <div role="row" key={hg.id} className="grid px-4" style={{ gridTemplateColumns: gridTemplate }}>
                    {hg.headers.map((h) => (
                      <div role="columnheader" key={h.id} className="py-2.5 pr-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        {h.column.getCanSort() ? (
                          <button className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground" onClick={h.column.getToggleSortingHandler()}>
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            <ArrowUpDown className="size-3" aria-hidden />
                          </button>
                        ) : (
                          flexRender(h.column.columnDef.header, h.getContext())
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div role="rowgroup" className="relative" style={{ height: virtualizer.getTotalSize() }}>
                {virtualizer.getVirtualItems().map((v) => {
                  const row = tableRows[v.index];
                  const t = row.original;
                  return (
                    <div
                      role="row"
                      key={row.id}
                      tabIndex={0}
                      onClick={() => setParams({ focus: t.id })}
                      onKeyDown={(e) => e.key === "Enter" && setParams({ focus: t.id })}
                      className={cn(
                        "absolute left-0 top-0 grid w-full cursor-pointer items-center border-b border-border px-4 transition-colors hover:bg-accent/40 focus-visible:bg-accent/50",
                        t.risk_level === "high" && "bg-risk-high-bg/40",
                      )}
                      style={{ gridTemplateColumns: gridTemplate, height: v.size, transform: `translateY(${v.start}px)` }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <div role="cell" key={cell.id} className="min-w-0 pr-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      )}

      <Dialog open={!!focused} onOpenChange={(o) => !o && setParams({})}>
        <DialogContent side="right" className="overflow-y-auto">
          <AnimatePresence>
            {focused && (
              <m.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={spring.gentle} className="space-y-5">
                <div>
                  <DialogTitle className="font-mono">{focused.id}</DialogTitle>
                  <DialogDescription>{formatDateTime(focused.timestamp)} · {focused.channel} {focused.direction}</DialogDescription>
                </div>
                <div className="font-mono text-3xl font-semibold tracking-tight">{formatINR(focused.amount_inr)}</div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Customer", focused.customer_name],
                    ["Customer type", focused.customer_type],
                    ["Customer risk", focused.customer_risk],
                    ["Account", focused.account_masked],
                    ["PEP", focused.is_pep ? "Yes" : "No"],
                    ["PAN on file", focused.has_pan ? "Yes" : "No"],
                    ["Counterparty", focused.counterparty_id ?? "—"],
                    ["Country", focused.counterparty_country],
                    ["Purpose code", focused.purpose_code ?? "—"],
                    ["Source", focused.source],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg border border-border p-2.5">
                      <dt className="text-[11px] text-muted-foreground">{k}</dt>
                      <dd className="mt-0.5 truncate font-medium capitalize">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-wrap gap-1.5">{(focused.rules ?? []).map((r) => <RuleChip key={r} id={r} />)}</div>
                <div className="flex items-center gap-2">
                  {focused.risk_level && <RiskBadge level={focused.risk_level} />}
                  {focused.decision_status && <StatusBadge status={focused.decision_status} />}
                </div>
                {focused.decision_id && (
                  <Button asChild className="w-full">
                    <Link to={`/app/decisions/${focused.decision_id}`}>
                      Open decision trace <ExternalLink />
                    </Link>
                  </Button>
                )}
              </m.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </div>
  );
}
