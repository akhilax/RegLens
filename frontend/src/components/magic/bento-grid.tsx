// Rebuilt from 21st.dev "Bento Grid" by dillionverma (https://21st.dev/@dillionverma/components/bento-grid)
import { m } from "motion/react";
import type { ReactNode } from "react";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { MagicCard } from "./magic-card";

export function BentoGrid({ children, className, inView = false }: { children: ReactNode; className?: string; inView?: boolean }) {
  return (
    <m.div
      className={cn("grid w-full auto-rows-[minmax(10rem,auto)] grid-cols-1 gap-4 md:grid-cols-6", className)}
      variants={staggerContainer()}
      initial="hidden"
      {...(inView ? { whileInView: "show", viewport: { once: true, margin: "-60px" } } : { animate: "show" })}
    >
      {children}
    </m.div>
  );
}

export function BentoCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <m.div variants={fadeUp} className={cn("min-w-0", className)}>
      <MagicCard className="h-full shadow-soft">{children}</MagicCard>
    </m.div>
  );
}
