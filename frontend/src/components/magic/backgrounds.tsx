// Dot Pattern — rebuilt from 21st.dev "Dot Pattern" by dillionverma (https://21st.dev/@dillionverma/components/dot-pattern)
// Spotlight — rebuilt from 21st.dev "Spotlight" by manuarora700 (https://21st.dev/@manuarora700/components/spotlight)
// Ripple — rebuilt from 21st.dev "Ripple" by dillionverma (https://21st.dev/@dillionverma/components/ripple)
import { m } from "motion/react";
import { type CSSProperties, useId } from "react";
import { cn } from "@/lib/utils";

export function DotPattern({ className, gap = 22, radius = 1 }: { className?: string; gap?: number; radius?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg aria-hidden className={cn("pointer-events-none absolute inset-0 h-full w-full fill-foreground/15", className)}>
      <defs>
        <pattern id={`dots-${id}`} width={gap} height={gap} patternUnits="userSpaceOnUse">
          <circle cx={gap / 2} cy={gap / 2} r={radius} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#dots-${id})`} />
    </svg>
  );
}

export function Spotlight({ className, fill = "var(--brand)" }: { className?: string; fill?: string }) {
  return (
    <m.svg
      aria-hidden
      initial={{ opacity: 0, x: "-30%", y: "-30%" }}
      animate={{ opacity: 1, x: "0%", y: "0%" }}
      transition={{ duration: 2, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn("pointer-events-none absolute z-0 h-[169%] w-[138%] lg:w-[84%]", className)}
      viewBox="0 0 3787 2842"
      fill="none"
    >
      <g filter="url(#spot-filter)">
        <ellipse cx="1924.71" cy="273.501" rx="1924.71" ry="273.501" transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)" fill={fill} fillOpacity="0.16" />
      </g>
      <defs>
        <filter id="spot-filter" x="0.860352" y="0.838989" width="3785.16" height="2840.26" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="151" result="effect1_foregroundBlur" />
        </filter>
      </defs>
    </m.svg>
  );
}

export function Ripple({ className, rings = 5, base = 46, step = 26, color = "var(--risk-low)" }: {
  className?: string;
  rings?: number;
  base?: number;
  step?: number;
  color?: string;
}) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 select-none [mask-image:radial-gradient(circle,white,transparent_75%)]", className)}>
      {Array.from({ length: rings }).map((_, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-ripple rounded-full border"
          style={
            {
              width: base + i * step,
              height: base + i * step,
              opacity: 0.55 - i * 0.09,
              borderColor: color,
              background: i === 0 ? `color-mix(in oklch, ${color} 25%, transparent)` : "transparent",
              "--i": i,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
