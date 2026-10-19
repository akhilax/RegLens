import { AlertTriangle, CheckCircle2, CircleDashed, Clock, Eye, RotateCcw, ShieldCheck, Siren, Users, XCircle } from "lucide-react";
import type { ComponentType } from "react";
import { Badge } from "@/components/ui/primitives";
import { RULE_LABEL, STATUS_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

const RISK: Record<string, { icon: ComponentType<{ className?: string }>; label: string; variant: "low" | "medium" | "high" }> = {
  low: { icon: ShieldCheck, label: "Low", variant: "low" },
  medium: { icon: AlertTriangle, label: "Medium", variant: "medium" },
  high: { icon: Siren, label: "High", variant: "high" },
};

export function RiskBadge({ level, className }: { level?: string | null; className?: string }) {
  const r = RISK[level ?? "low"] ?? RISK.low;
  const Icon = r.icon;
  return (
    <Badge variant={r.variant} className={className}>
      <Icon aria-hidden />
      {r.label}
      <span className="sr-only"> risk</span>
    </Badge>
  );
}

const STATUS_ICON: Record<string, ComponentType<{ className?: string }>> = {
  auto_cleared: CheckCircle2,
  logged: CircleDashed,
  pending_review: Clock,
  in_review: Eye,
  awaiting_second_approval: Users,
  approved: CheckCircle2,
  rejected: XCircle,
  needs_re_review: RotateCcw,
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const Icon = STATUS_ICON[status] ?? Clock;
  const tone =
    status === "approved" || status === "auto_cleared"
      ? "low"
      : status === "rejected"
        ? "high"
        : status === "needs_re_review" || status === "awaiting_second_approval"
          ? "medium"
          : "default";
  return (
    <Badge variant={tone as "low" | "high" | "medium" | "default"} className={className}>
      <Icon aria-hidden />
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function RuleChip({ id, className }: { id: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10.5px] font-medium",
        className,
      )}
      title={RULE_LABEL[id] ?? id}
    >
      <span className="font-mono text-brand">{id}</span>
      <span className="hidden text-muted-foreground sm:inline">{RULE_LABEL[id]}</span>
    </span>
  );
}
