// Rebuilt from 21st.dev "Aurora Background" by manuarora700 (https://21st.dev/@manuarora700/components/aurora-background)
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AuroraBackground({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <div className={cn("relative isolate overflow-hidden", className)}>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className={cn(
            "absolute -inset-[10px] opacity-60 blur-[10px] will-change-transform dark:opacity-45",
            "[--stripes:repeating-linear-gradient(100deg,var(--background)_0%,var(--background)_7%,transparent_10%,transparent_12%,var(--background)_16%)]",
            "[--aurora:repeating-linear-gradient(100deg,oklch(0.62_0.24_288)_10%,oklch(0.7_0.16_250)_15%,oklch(0.75_0.12_220)_20%,oklch(0.72_0.2_310)_25%,oklch(0.6_0.22_270)_30%)]",
            "[background-image:var(--stripes),var(--aurora)] [background-size:300%,_200%] [background-position:50%_50%,50%_50%]",
            "after:absolute after:inset-0 after:animate-aurora after:mix-blend-difference after:content-['']",
            "after:[background-image:var(--stripes),var(--aurora)] after:[background-size:200%,_100%] after:[background-attachment:fixed]",
            "[mask-image:radial-gradient(ellipse_at_70%_0%,black_10%,transparent_70%)]",
          )}
        />
      </div>
      {children}
    </div>
  );
}
