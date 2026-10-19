// Rebuilt from 21st.dev "Animated Circular Progress Bar" by dillionverma
// (https://21st.dev/@dillionverma/components/animated-circular-progress-bar)
import { m } from "motion/react";
import type { ReactNode } from "react";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface Props {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  className?: string;
  children?: ReactNode;
  label: string;
}

export function CircularProgress({
  value,
  size = 160,
  stroke = 10,
  color = "var(--brand)",
  track = "var(--muted)",
  className,
  children,
  label,
}: Props) {
  const r = (size - stroke) / 2;
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 overflow-visible">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <m.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: clamped }}
          transition={spring.gentle}
          style={{ filter: `drop-shadow(0 0 8px color-mix(in oklch, ${color} 55%, transparent))` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
