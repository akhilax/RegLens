import { m } from "motion/react";
import { AlertOctagon, RefreshCw } from "lucide-react";
import { type ReactNode, useId } from "react";
import { Button } from "@/components/ui/button";
import { fadeUp } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <m.header variants={fadeUp} initial="hidden" animate="show" className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-xs font-medium uppercase tracking-[0.14em] text-brand">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </m.header>
  );
}

/** Lightweight inline illustration: a lens over a ledger. */
function LensIllustration({ className }: { className?: string }) {
  const gid = `es-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 160 120" className={cn("h-28 w-36", className)} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="var(--brand)" />
          <stop offset="1" stopColor="var(--brand-2)" />
        </linearGradient>
      </defs>
      <rect x="18" y="22" width="92" height="76" rx="10" fill="var(--card)" stroke="var(--border-strong)" />
      {[38, 52, 66, 80].map((y, i) => (
        <rect key={y} x="30" y={y} width={i % 2 ? 48 : 64} height="6" rx="3" fill="var(--muted)" />
      ))}
      <m.g
        initial={{ x: 0, y: 0 }}
        animate={{ x: [0, 10, -4, 0], y: [0, -6, 4, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <circle cx="104" cy="58" r="22" fill="var(--brand-glow)" stroke={`url(#${gid})`} strokeWidth="5" />
        <path d="M120 74 L138 92" stroke={`url(#${gid})`} strokeWidth="7" strokeLinecap="round" />
      </m.g>
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <m.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className={cn("flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border-strong p-10 text-center", className)}
    >
      <LensIllustration />
      <div>
        <p className="font-medium">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </m.div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-risk-high/30 bg-risk-high-bg p-8 text-center">
      <AlertOctagon className="size-8 text-risk-high" aria-hidden />
      <div>
        <p className="font-medium">Couldn’t reach the RegLens API</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {message}. Is the backend running? Start everything with <code className="font-mono">npm run dev</code>.
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw /> Retry
        </Button>
      )}
    </div>
  );
}
