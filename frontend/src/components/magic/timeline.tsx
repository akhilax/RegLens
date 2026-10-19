// Rebuilt from 21st.dev "Timeline" by manuarora700 (https://21st.dev/@manuarora700/components/timeline)
import { m } from "motion/react";
import type { ReactNode } from "react";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface TimelineItem {
  key: string | number;
  marker?: ReactNode;
  tone?: "brand" | "low" | "medium" | "high" | "muted";
  content: ReactNode;
}

const TONE: Record<NonNullable<TimelineItem["tone"]>, string> = {
  brand: "bg-brand shadow-[0_0_0_4px_var(--brand-glow)]",
  low: "bg-risk-low shadow-[0_0_0_4px_var(--risk-low-bg)]",
  medium: "bg-risk-medium shadow-[0_0_0_4px_var(--risk-medium-bg)]",
  high: "bg-risk-high shadow-[0_0_0_4px_var(--risk-high-bg)]",
  muted: "bg-muted-foreground/50",
};

/** Vertical timeline; the rail draws itself, then entries stagger in. */
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <m.ol className={cn("relative ml-2", className)} variants={staggerContainer(0.06)} initial="hidden" animate="show">
      <m.span
        aria-hidden
        className="absolute bottom-2 left-[5px] top-2 w-px origin-top bg-gradient-to-b from-brand via-border-strong to-transparent"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
      {items.map((item) => (
        <m.li key={item.key} variants={fadeUp} className="relative pb-4 pl-7 last:pb-0">
          <span className={cn("absolute left-0 top-1.5 size-[11px] rounded-full ring-2 ring-background", TONE[item.tone ?? "brand"])} />
          {item.content}
        </m.li>
      ))}
    </m.ol>
  );
}
