// React Flow is heavy, so this module is lazy-loaded by the Decision Trace page.
import "@xyflow/react/dist/style.css";
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  Handle,
  MarkerType,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { m } from "motion/react";
import { Bot, FileSearch, Fingerprint, Link2, ListChecks, Receipt, ShieldAlert, ShieldCheck, UserCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DecisionDetail } from "@/api/client";
import { formatINR, shortHash } from "@/lib/format";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Kind = "txn" | "features" | "rule" | "chunk" | "llm" | "guard" | "human" | "audit";
interface NodeInput {
  kind: Kind;
  title: string;
  subtitle?: string;
  meta?: string;
  tone?: "ok" | "warn" | "bad" | "brand";
  chunkId?: string;
  selected?: boolean;
}
interface TraceData extends Record<string, unknown> {
  kind: Kind;
  title: string;
  subtitle?: string;
  meta?: string;
  tone?: "ok" | "warn" | "bad" | "brand";
  chunkId?: string;
  selected?: boolean;
  step: number;
}

const ICON: Record<Kind, typeof Receipt> = {
  txn: Receipt, features: Fingerprint, rule: ListChecks, chunk: FileSearch, llm: Bot, guard: ShieldAlert, human: UserCheck, audit: Link2,
};

function TraceNode({ data }: NodeProps<Node<TraceData>>) {
  const Icon = data.kind === "guard" && data.tone === "ok" ? ShieldCheck : ICON[data.kind];
  const tone = {
    ok: "border-risk-low/50 [--glow:var(--risk-low-bg)]",
    warn: "border-risk-medium/50 [--glow:var(--risk-medium-bg)]",
    bad: "border-risk-high/60 [--glow:var(--risk-high-bg)]",
    brand: "border-brand/50 [--glow:var(--brand-glow)]",
  }[data.tone ?? "brand"];
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.85, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={spring.bouncy}
      className={cn(
        "w-[188px] rounded-xl border bg-card/95 px-3 py-2.5 text-left shadow-[0_8px_30px_-8px_var(--glow)] backdrop-blur",
        tone,
        data.selected && "ring-2 ring-brand",
        data.kind === "chunk" && "cursor-pointer",
      )}
    >
      <Handle type="target" position={Position.Left} className="!size-2 !border-0 !bg-border-strong" />
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 shrink-0 text-brand" aria-hidden />
        <span className="truncate text-xs font-semibold">{data.title}</span>
      </div>
      {data.subtitle && <div className="mt-1 line-clamp-2 text-[10.5px] leading-snug text-muted-foreground">{data.subtitle}</div>}
      {data.meta && <div className="mt-1.5 truncate font-mono text-[9.5px] text-muted-foreground">{data.meta}</div>}
      <Handle type="source" position={Position.Right} className="!size-2 !border-0 !bg-border-strong" />
    </m.div>
  );
}

const nodeTypes = { trace: TraceNode };
const COL = 222;

function build(d: DecisionDetail, selectedChunk: string | null) {
  const nodes: Node<TraceData>[] = [];
  const edges: Edge[] = [];
  const cited = new Set(
    ((d.output.applicable_regulations as { citation_chunk_ids: string[] }[] | undefined) ?? []).flatMap((r) => r.citation_chunk_ids),
  );
  const add = (id: string, col: number, row: number, rows: number, data: NodeInput, step: number) =>
    nodes.push({ id, type: "trace", position: { x: col * COL, y: (row - (rows - 1) / 2) * 104 }, data: { ...data, step } });
  const link = (a: string, b: string, step: number, danger = false) =>
    edges.push({
      id: `${a}->${b}`,
      source: a,
      target: b,
      animated: true,
      data: { step },
      style: { stroke: danger ? "var(--risk-high)" : "var(--brand)", strokeWidth: 1.5, opacity: 0.8 },
      markerEnd: { type: MarkerType.ArrowClosed, color: danger ? "var(--risk-high)" : "var(--brand)", width: 16, height: 16 },
    });

  add("features", 0, 0, 1, {
    kind: "txn", title: `${d.transaction_id} · ${formatINR(d.amount_inr)}`,
    subtitle: `${d.channel} ${d.direction} · ${d.customer_type}`,
    meta: `${Object.keys(d.features).length} features · PII removed`, tone: "brand",
  }, 0);

  const rules = d.rules_fired.length ? d.rules_fired : null;
  if (rules) {
    rules.forEach((r, i) => {
      add(`rule-${r.rule_id}`, 1, i, rules.length, { kind: "rule", title: r.rule_id, subtitle: r.name, meta: r.deadline ? `due ${r.deadline}` : r.deadline_basis, tone: r.severity === "critical" || r.severity === "high" ? "bad" : r.severity === "medium" ? "warn" : "ok" }, 2);
      link("features", `rule-${r.rule_id}`, 2);
    });
  } else {
    add("rule-none", 1, 0, 1, { kind: "rule", title: "No rule fired", subtitle: "All thresholds below limits", tone: "ok" }, 2);
    link("features", "rule-none", 2);
  }

  const chunks = d.retrieved.slice(0, 6);
  chunks.forEach((c, i) => {
    const id = `chunk-${i}`;
    add(id, 2, i, chunks.length, {
      kind: "chunk", title: c.chunk_id.split("#")[1] ?? c.chunk_id, subtitle: c.heading,
      meta: `${c.reg_id} v${c.version} · ${shortHash(c.content_hash, 6)} · ${c.method}`,
      tone: cited.has(c.chunk_id) ? "ok" : "brand", chunkId: c.chunk_id, selected: selectedChunk === c.chunk_id,
    }, 3);
    const ref = `${c.reg_id}#${c.section}`;
    const sources = rules ? rules.filter((r) => r.source_refs.includes(ref)).map((r) => `rule-${r.rule_id}`) : [];
    (sources.length ? sources : [rules ? `rule-${rules[0].rule_id}` : "rule-none"]).forEach((src) => link(src, id, 3));
    link(id, "llm", 4);
  });
  if (!chunks.length) link(rules ? `rule-${rules[0].rule_id}` : "rule-none", "llm", 4);

  add("llm", 3, 0, 1, { kind: "llm", title: d.model_name, subtitle: d.fallback_used ? "Invalid JSON twice → rules-only fallback" : `confidence ${(d.confidence * 100).toFixed(0)}% · ${d.latency_ms.toFixed(0)} ms`, meta: d.prompt_version, tone: d.fallback_used ? "bad" : "brand" }, 4);
  add("guard", 4, 0, 1, {
    kind: "guard", title: d.citation_issue ? `Guardrail: ${d.invalid_citations.length} stripped` : "Guardrail passed",
    subtitle: d.citation_issue ? "Hallucinated / foreign citations removed" : "All citations were retrieved for this request", tone: d.citation_issue ? "bad" : "ok",
  }, 5);
  link("llm", "guard", 5, d.citation_issue);
  const approvals = d.reviews.filter((r) => r.action === "approve" || r.action === "modify").map((r) => r.reviewer);
  add("human", 5, 0, 1, {
    kind: "human", title: d.requires_review ? `Human: ${d.status.replaceAll("_", " ")}` : "Auto-routed",
    subtitle: d.requires_review ? `reasons: ${d.routing_reasons.join(", ")}` : "No review needed", meta: approvals.length ? `approved by ${approvals.join(" + ")}` : d.requires_four_eyes ? "four-eyes required" : undefined,
    tone: d.status === "approved" ? "ok" : d.status === "rejected" ? "bad" : "warn",
  }, 6);
  link("guard", "human", 6);
  add("audit", 6, 0, 1, { kind: "audit", title: `Audit · ${d.audit.length} block(s)`, subtitle: d.audit.map((a) => a.event_type).slice(-2).join(" → "), meta: d.audit.length ? shortHash(d.audit[d.audit.length - 1].hash, 8) : undefined, tone: "brand" }, 7);
  link("human", "audit", 7);
  return { nodes, edges };
}

function Graph({ decision, selectedChunk, onSelectChunk }: Props) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setInterval(() => setStep((s) => (s >= 7 ? s : s + 1)), reduce ? 10 : 420);
    return () => clearInterval(t);
  }, [decision.id]);
  const { nodes, edges } = useMemo(() => build(decision, selectedChunk), [decision, selectedChunk]);
  const visibleNodes = nodes.filter((n) => n.data.step <= step);
  const visibleEdges = edges.filter((e) => (e.data?.step as number) <= step && visibleNodes.some((n) => n.id === e.target));
  const flow = useReactFlow();
  useEffect(() => {
    const t = setTimeout(() => flow.fitView({ padding: 0.12, maxZoom: 1.1, duration: 350 }), 60);
    return () => clearTimeout(t);
  }, [step, flow]);

  return (
    <ReactFlow
      nodes={visibleNodes}
      edges={visibleEdges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.12, maxZoom: 1.1 }}
      minZoom={0.3}
      maxZoom={1.6}
      nodesDraggable
      nodesConnectable={false}
      proOptions={{ hideAttribution: true }}
      onNodeClick={(_, n) => n.data.chunkId && onSelectChunk(n.data.chunkId as string)}
      colorMode={document.documentElement.classList.contains("dark") ? "dark" : "light"}
      style={{ background: "transparent" }}
      aria-label="Decision trace graph"
    >
      <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="var(--border-strong)" />
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
  );
}

interface Props {
  decision: DecisionDetail;
  selectedChunk: string | null;
  onSelectChunk: (id: string) => void;
}

export default function TraceGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <Graph key={props.decision.id} {...props} />
    </ReactFlowProvider>
  );
}
