// Rebuilt from 21st.dev "Animated Tooltip" by manuarora700 (https://21st.dev/@manuarora700/components/animated-tooltip)
import { AnimatePresence, m, useMotionValue, useSpring, useTransform } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface Person {
  id: string;
  name: string;
  role: string;
  active?: boolean;
}

const HUES = [288, 200, 160, 30, 330];

export function Avatar({ name, idx = 0, className }: { name: string; idx?: number; className?: string }) {
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2);
  const hue = HUES[idx % HUES.length];
  return (
    <span
      className={cn("grid size-8 place-items-center rounded-full text-[11px] font-semibold text-white ring-2 ring-background", className)}
      style={{ background: `linear-gradient(135deg, oklch(0.62 0.2 ${hue}), oklch(0.45 0.2 ${hue + 30}))` }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function AnimatedTooltip({ people }: { people: Person[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const x = useMotionValue(0);
  const rotate = useSpring(useTransform(x, [-60, 60], [-18, 18]), { stiffness: 140, damping: 8 });
  const translateX = useSpring(useTransform(x, [-60, 60], [-30, 30]), { stiffness: 140, damping: 8 });

  return (
    <div className="flex items-center">
      {people.map((p, i) => (
        <div
          key={p.id}
          className="group relative -mr-2"
          onMouseEnter={() => setHovered(p.id)}
          onMouseLeave={() => setHovered(null)}
          onMouseMove={(e) => x.set(e.nativeEvent.offsetX - 16)}
        >
          <AnimatePresence>
            {hovered === p.id && (
              <m.div
                initial={{ opacity: 0, y: 12, scale: 0.6 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 260, damping: 12 } }}
                exit={{ opacity: 0, y: 12, scale: 0.6 }}
                style={{ translateX, rotate }}
                className="absolute -top-14 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center whitespace-nowrap rounded-md bg-popover px-3 py-1.5 text-xs shadow-lift"
              >
                <span className="font-semibold">{p.name}</span>
                <span className="text-[10px] text-muted-foreground">{p.role}</span>
              </m.div>
            )}
          </AnimatePresence>
          <Avatar
            name={p.name}
            idx={i}
            className={cn("transition-transform duration-300 group-hover:z-30 group-hover:scale-110", p.active && "ring-brand")}
          />
        </div>
      ))}
    </div>
  );
}
