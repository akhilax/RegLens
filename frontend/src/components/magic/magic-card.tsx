// Rebuilt from 21st.dev "Magic Card" by dillionverma (https://21st.dev/@dillionverma/components/magic-card)
import { m, useMotionTemplate, useMotionValue } from "motion/react";
import { type HTMLAttributes, type PointerEvent, useCallback } from "react";
import { cn } from "@/lib/utils";

interface MagicCardProps extends HTMLAttributes<HTMLDivElement> {
  gradientSize?: number;
  gradientColor?: string;
}

export function MagicCard({
  children,
  className,
  gradientSize = 260,
  gradientColor = "var(--brand-glow)",
  ...props
}: MagicCardProps) {
  const x = useMotionValue(-gradientSize);
  const y = useMotionValue(-gradientSize);
  const onMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      x.set(e.clientX - r.left);
      y.set(e.clientY - r.top);
    },
    [x, y],
  );
  const onLeave = useCallback(() => {
    x.set(-gradientSize);
    y.set(-gradientSize);
  }, [x, y, gradientSize]);

  const glow = useMotionTemplate`radial-gradient(${gradientSize}px circle at ${x}px ${y}px, ${gradientColor}, transparent 100%)`;
  const ring = useMotionTemplate`radial-gradient(${gradientSize}px circle at ${x}px ${y}px, var(--brand), var(--border) 100%)`;

  return (
    <div
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={cn("group relative rounded-2xl p-px", className)}
      {...props}
    >
      <m.div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-60 transition-opacity duration-300 group-hover:opacity-100" style={{ background: ring }} />
      <div className="relative h-full rounded-[calc(1rem-1px)] bg-card/90 backdrop-blur-xl dark:bg-card/80">
        <m.div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: glow }} />
        <div className="relative h-full">{children}</div>
      </div>
    </div>
  );
}
