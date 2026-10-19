import { animate, m, useMotionValue, useTransform } from "motion/react";
import { ShieldCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Press-and-hold confirmation with a radial fill — used for STR approvals so a high-stakes
 * decision can't happen by an accidental click. Works with pointer and keyboard (hold Space/Enter).
 */
export function HoldToApprove({
  onConfirm,
  label = "Hold to approve",
  duration = 1.4,
  disabled,
  className,
}: {
  onConfirm: () => void;
  label?: string;
  duration?: number;
  disabled?: boolean;
  className?: string;
}) {
  const progress = useMotionValue(0);
  const ctrl = useRef<ReturnType<typeof animate> | null>(null);
  const done = useRef(false);
  const fill = useTransform(progress, [0, 1], [0, 1]);
  const scale = useTransform(progress, [0, 1], [1, 0.97]);

  const start = () => {
    if (disabled || done.current) return;
    ctrl.current?.stop();
    ctrl.current = animate(progress, 1, {
      duration: duration * (1 - progress.get()),
      ease: "linear",
      onComplete: () => {
        done.current = true;
        onConfirm();
        setTimeout(() => {
          done.current = false;
          progress.set(0);
        }, 600);
      },
    });
  };
  const cancel = () => {
    if (done.current) return;
    ctrl.current?.stop();
    ctrl.current = animate(progress, 0, { duration: 0.25, ease: "easeOut" });
  };
  useEffect(() => () => ctrl.current?.stop(), []);

  return (
    <m.button
      type="button"
      disabled={disabled}
      style={{ scale }}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => (e.key === " " || e.key === "Enter") && cancel()}
      aria-label={`${label} (press and hold)`}
      className={cn(
        "relative flex h-10 select-none items-center gap-2.5 overflow-hidden rounded-xl border border-risk-low/40 bg-risk-low-bg pl-2 pr-4 text-sm font-medium text-risk-low",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      <m.span aria-hidden className="absolute inset-0 origin-left bg-risk-low/20" style={{ scaleX: fill }} />
      <span className="relative grid size-7 place-items-center">
        <svg viewBox="0 0 28 28" className="absolute inset-0 -rotate-90">
          <circle cx="14" cy="14" r="12" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
          <m.circle cx="14" cy="14" r="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ pathLength: fill }} />
        </svg>
        <ShieldCheck className="size-3.5" />
      </span>
      <span className="relative">{label}</span>
    </m.button>
  );
}
