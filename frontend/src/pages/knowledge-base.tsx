import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, m } from "motion/react";
import { ArrowRight, BookOpen, ExternalLink, FileDiff, GitBranch, Hash, Sparkles, Upload } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { api, type IngestOut, type SectionDiff } from "@/api/client";
import { useDocument, useDocuments } from "@/api/hooks";
import { RiskBadge } from "@/components/app/badges";
import { RowsSkeleton } from "@/components/app/page-skeleton";
import { ErrorState, PageHeader } from "@/components/app/states";
import { BorderBeam } from "@/components/magic/border-beam";
import { FileUpload } from "@/components/magic/file-upload";
import { MagicCard } from "@/components/magic/magic-card";
import { ShimmerButton } from "@/components/magic/shimmer-button";
import { Timeline } from "@/components/magic/timeline";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@/components/ui/primitives";
import { diffWords } from "@/lib/diff";
import { formatDate, shortHash } from "@/lib/format";
import { fadeUp, spring, staggerContainer } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useUI } from "@/store/ui";

function DiffSection({ d, index }: { d: SectionDiff; index: number }) {
  const { left, right } = diffWords(d.old_text ?? "", d.new_text ?? "");
  return (
    <m.div variants={fadeUp} className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs">
        <Badge variant={d.change === "changed" ? "medium" : d.change === "added" ? "low" : "high"}>{d.change}</Badge>
        <span className="font-medium">{d.heading}</span>
        <span className="ml-auto hidden font-mono text-[10.5px] text-muted-foreground sm:block">
          {d.old_hash ? shortHash(d.old_hash, 6) : "∅"} → {d.new_hash ? shortHash(d.new_hash, 6) : "∅"}
        </span>
      </div>
      <div className="grid md:grid-cols-2">
        {[
          { label: d.old_chunk_id ?? "—", parts: left, side: "old" },
          { label: d.new_chunk_id ?? "—", parts: right, side: "new" },
        ].map((col, ci) => (
          <m.div
            key={col.side}
            initial={{ opacity: 0, x: ci ? 16 : -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...spring.gentle, delay: 0.15 + index * 0.12 + ci * 0.08 }}
            className={cn("p-3 text-[13px] leading-relaxed", ci === 0 && "border-b border-border md:border-b-0 md:border-r")}
          >
            <div className="mb-1.5 font-mono text-[10.5px] text-muted-foreground">{col.label}</div>
            {col.parts.map((p, i) =>
              p.type === "same" ? (
                <span key={i} className="text-muted-foreground">{p.text}</span>
              ) : (
                <m.span
                  key={i}
                  initial={{ backgroundSize: "0% 100%" }}
                  animate={{ backgroundSize: "100% 100%" }}
                  transition={{ duration: 0.6, delay: 0.5 + index * 0.12 }}
                  className={cn(
                    "rounded-sm bg-no-repeat px-0.5",
                    p.type === "add" ? "bg-[linear-gradient(var(--risk-low-bg),var(--risk-low-bg))] text-risk-low" : "bg-[linear-gradient(var(--risk-high-bg),var(--risk-high-bg))] text-risk-high line-through",
                  )}
                >
                  {p.text}
                </m.span>
              ),
            )}
          </m.div>
        ))}
      </div>
    </m.div>
  );
}

function ImpactResult({ result }: { result: IngestOut }) {
  const changed = result.diff.filter((d) => d.change !== "unchanged");
  return (
    <m.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spring.gentle} className="space-y-5">
      <Card className="overflow-hidden">
        <BorderBeam size={140} duration={7} />
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileDiff className="size-4 text-brand" /> {result.reg_id} v{result.previous_version ?? "–"} → v{result.version}</CardTitle>
          <CardDescription>
            {result.status === "unchanged" ? "Identical content — nothing to do." : `${changed.length} section(s) changed · ${result.diff.length - changed.length} unchanged · old chunks kept as superseded`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <m.div variants={staggerContainer(0.1)} initial="hidden" animate="show" className="space-y-3">
            {changed.map((d, i) => <DiffSection key={d.section} d={d} index={i} />)}
          </m.div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><GitBranch className="size-4 text-risk-medium" /> Impacted decisions</CardTitle>
          <CardDescription>
            Decisions that cited a changed clause are flagged <span className="font-medium text-risk-medium">needs re-review</span>.
            {result.informational > 0 && ` ${result.informational} more cite unchanged sections of the old version.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {result.impacted.length === 0 ? (
            <p className="text-sm text-muted-foreground">No decision cited the changed clauses.</p>
          ) : (
            <m.ul variants={staggerContainer(0.06, 0.6)} initial="hidden" animate="show" className="space-y-2">
              {result.impacted.map((i) => (
                <m.li key={i.decision_id} variants={fadeUp}>
                  <Link to={`/app/decisions/${i.decision_id}`} className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-border-strong hover:bg-accent/30">
                    <span className="font-mono text-xs">#{i.decision_id}</span>
                    <span className="font-mono text-xs text-muted-foreground">{i.transaction_id}</span>
                    <span className="flex flex-wrap gap-1">{i.sections.map((s) => <Badge key={s} variant="mono">{s}</Badge>)}</span>
                    <span className="ml-auto flex items-center gap-2">
                      <RiskBadge level={i.risk_level} />
                      <ArrowRight className="size-4 text-muted-foreground" />
                    </span>
                  </Link>
                </m.li>
              ))}
            </m.ul>
          )}
        </CardContent>
      </Card>
    </m.div>
  );
}

export default function KnowledgeBase() {
  const qc = useQueryClient();
  const reviewer = useUI((s) => s.reviewer);
  const [params, setParams] = useSearchParams();
  const { data: docs, error, isLoading, refetch } = useDocuments();
  const selectedId = params.get("doc") ?? docs?.[0]?.reg_id ?? null;
  const { data: doc, isLoading: docLoading } = useDocument(selectedId);
  const [result, setResult] = useState<IngestOut | null>(null);
  const [busy, setBusy] = useState(false);

  const handle = async (p: Promise<IngestOut>) => {
    setBusy(true);
    try {
      const r = await p;
      setResult(r);
      setParams({ doc: r.reg_id });
      qc.invalidateQueries();
      if (r.status === "unchanged") toast("Already up to date", { description: `${r.reg_id} v${r.version} has identical content.` });
      else toast.success(`${r.reg_id} v${r.version} ingested`, { description: `${r.impacted.length} decision(s) need re-review` });
    } catch (e) {
      toast.error("Upload failed", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Traceable knowledge base"
        title="Regulations"
        description="Section-aware chunks with stable IDs, SHA-256 hashes and versions. New versions supersede old chunks (kept for audit) and trigger impact analysis."
      />
      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="space-y-5">
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>
            ) : (
              <m.div variants={staggerContainer(0.06)} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2">
                {docs?.map((d) => (
                  <m.button key={d.reg_id} variants={fadeUp} whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }} transition={spring.snappy} onClick={() => setParams({ doc: d.reg_id })} className="text-left" aria-pressed={selectedId === d.reg_id}>
                    <MagicCard className={cn("h-full", selectedId === d.reg_id && "ring-2 ring-brand/60")}>
                      <div className="flex h-full flex-col gap-2 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-brand">{d.reg_id}</span>
                          <span className="flex gap-1">
                            <Badge>v{d.version}</Badge>
                            {d.versions.length > 1 && <Badge variant="medium">{d.versions.length} versions</Badge>}
                          </span>
                        </div>
                        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{d.title}</h3>
                        <p className="text-xs text-muted-foreground">{d.issuer}</p>
                        <div className="mt-auto flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1"><BookOpen className="size-3" />{d.chunk_count} sections</span>
                          <span className="flex items-center gap-1"><Hash className="size-3" />{shortHash(d.content_hash, 4)}</span>
                          <span className="ml-auto">{d.citing_decisions} citing</span>
                        </div>
                      </div>
                    </MagicCard>
                  </m.button>
                ))}
              </m.div>
            )}
            <AnimatePresence mode="wait">{result && <ImpactResult key={`${result.reg_id}-${result.version}`} result={result} />}</AnimatePresence>
          </div>

          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Upload className="size-4 text-brand" /> Upload a new version</CardTitle>
                <CardDescription>Markdown with front matter (reg_id, title, issuer, version) and anchored sections <code className="font-mono">## Heading {"{#anchor}"}</code>.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ShimmerButton className="w-full" disabled={busy} onClick={() => handle(api.demoAmendment())}>
                  <Sparkles className="size-4" /> Load demo amendment · PML Rules v2
                </ShimmerButton>
                <FileUpload accept=".md,text/markdown" onFile={(f) => handle(api.uploadDocument(f, reviewer))} disabled={busy} title="Drop a regulation .md" hint="Same reg_id → new version + impact analysis" />
              </CardContent>
            </Card>

            <Card>
              {docLoading || !doc ? (
                <CardContent className="pt-5"><RowsSkeleton rows={6} /></CardContent>
              ) : (
                <AnimatePresence mode="wait">
                  <m.div key={`${doc.reg_id}-${doc.version}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <CardHeader>
                      <CardTitle>{doc.title}</CardTitle>
                      <CardDescription className="flex flex-wrap items-center gap-2">
                        {doc.issuer} · effective {doc.effective_date ? formatDate(doc.effective_date) : "—"}
                        {doc.source_url && (
                          <a href={doc.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
                            source <ExternalLink className="size-3" />
                          </a>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <p className="rounded-lg border border-risk-medium/30 bg-risk-medium-bg px-3 py-2 text-xs text-risk-medium">{doc.banner.replace(/^>\s*/gm, "")}</p>
                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Version history</h4>
                        <Timeline
                          items={doc.versions.map((v) => ({
                            key: v.id,
                            tone: v.status === "active" ? "brand" : "muted",
                            content: (
                              <div className="text-xs">
                                <span className="font-medium">v{v.version}</span>{" "}
                                <Badge variant={v.status === "active" ? "low" : "outline"} className="ml-1">{v.status}</Badge>
                                <div className="mt-0.5 text-muted-foreground">
                                  {formatDate(v.uploaded_at)} by {v.uploaded_by} · <span className="font-mono">{shortHash(v.content_hash, 6)}</span>
                                </div>
                              </div>
                            ),
                          }))}
                        />
                      </div>
                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sections</h4>
                        <ul className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
                          {doc.chunks.map((c) => (
                            <li key={c.id}>
                              <details className="group rounded-lg border border-border px-3 py-2 open:bg-muted/30">
                                <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium">
                                  <ArrowRight className="size-3 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                                  <span className="truncate">{c.heading}</span>
                                  <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">{shortHash(c.content_hash, 4)}</span>
                                </summary>
                                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{c.text}</p>
                                <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">{c.id}</p>
                              </details>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </m.div>
                </AnimatePresence>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
