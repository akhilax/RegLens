// Rebuilt from 21st.dev "Border Beam" by dillionverma (https://21st.dev/@dillionverma/components/border-beam)
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface BorderBeamProps {
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  className?: string;
}

export function BorderBeam({
  size = 120,
  duration = 8,
  delay = 0,
  colorFrom = "var(--brand)",
  colorTo = "var(--brand-2)",
  className,
}: BorderBeamProps) {
  return (
    <div
      aria-hidden
      style={{ "--size": size, "--duration": duration, "--delay": `-${delay}s`, "--color-from": colorFrom, "--color-to": colorTo } as CSSProperties}
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit] [border:1.5px_solid_transparent]",
        "![mask-clip:padding-box,border-box] ![mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(white,white)]",
        "after:absolute after:aspect-square after:w-[calc(var(--size)*1px)] after:animate-border-beam after:[animation-delay:var(--delay)]",
        "after:[background:linear-gradient(to_left,var(--color-from),var(--color-to),transparent)]",
        "after:[offset-anchor:90%_50%] after:[offset-path:rect(0_auto_auto_0_round_calc(var(--size)*1px))]",
        className,
      )}
    />
  );
}
