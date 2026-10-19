// Rebuilt from 21st.dev "Animated Beam" by dillionverma (https://21st.dev/@dillionverma/components/animated-beam)
// Adds flowing particles that travel along the beam path (CSS offset-path driven by Motion).
import { m, useReducedMotion } from "motion/react";
import { type RefObject, useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";

interface AnimatedBeamProps {
  containerRef: RefObject<HTMLElement | null>;
  fromRef: RefObject<HTMLElement | null>;
  toRef: RefObject<HTMLElement | null>;
  curvature?: number;
  duration?: number;
  delay?: number;
  reverse?: boolean;
  particles?: number;
  className?: string;
}

export function AnimatedBeam({
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  duration = 3.2,
  delay = 0,
  reverse = false,
  particles = 2,
  className,
}: AnimatedBeamProps) {
  const id = useId().replace(/:/g, "");
  const reduce = useReducedMotion();
  const [path, setPath] = useState("");
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const update = () => {
      const c = containerRef.current?.getBoundingClientRect();
      const a = fromRef.current?.getBoundingClientRect();
      const b = toRef.current?.getBoundingClientRect();
      if (!c || !a || !b) return;
      const horizontal = Math.abs(b.left - a.left) >= Math.abs(b.top - a.top);
      const sx = horizontal ? a.right - c.left : a.left - c.left + a.width / 2;
      const sy = horizontal ? a.top - c.top + a.height / 2 : a.bottom - c.top;
      const ex = horizontal ? b.left - c.left : b.left - c.left + b.width / 2;
      const ey = horizontal ? b.top - c.top + b.height / 2 : b.top - c.top;
      const cx = (sx + ex) / 2;
      const cy = (sy + ey) / 2 - curvature;
      setBox({ w: c.width, h: c.height });
      setPath(`M ${sx},${sy} Q ${cx},${cy} ${ex},${ey}`);
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [containerRef, fromRef, toRef, curvature]);

  if (!path) return null;
  const gradient = reverse ? { x1: ["90%", "-10%"], x2: ["100%", "0%"] } : { x1: ["10%", "110%"], x2: ["0%", "100%"] };

  return (
    <>
      <svg
        aria-hidden
        width={box.w}
        height={box.h}
        viewBox={`0 0 ${box.w} ${box.h}`}
        className={cn("pointer-events-none absolute left-0 top-0 overflow-visible", className)}
      >
        <path d={path} stroke="var(--border-strong)" strokeWidth={2} fill="none" strokeLinecap="round" />
        <path d={path} stroke={`url(#beam-${id})`} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <defs>
          <m.linearGradient
            id={`beam-${id}`}
            gradientUnits="userSpaceOnUse"
            initial={{ x1: "0%", x2: "0%", y1: "0%", y2: "0%" }}
            animate={reduce ? undefined : { ...gradient, y1: ["0%", "0%"], y2: ["0%", "0%"] }}
            transition={{ delay, duration, ease: [0.16, 1, 0.3, 1], repeat: Infinity, repeatDelay: 0 }}
          >
            <stop stopColor="var(--brand)" stopOpacity="0" />
            <stop stopColor="var(--brand)" />
            <stop offset="32.5%" stopColor="var(--brand-2)" />
            <stop offset="100%" stopColor="var(--brand-2)" stopOpacity="0" />
          </m.linearGradient>
        </defs>
      </svg>
      {!reduce &&
        Array.from({ length: particles }).map((_, i) => (
          <m.span
            key={i}
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 size-1.5 rounded-full bg-brand shadow-[0_0_10px_2px_var(--brand-glow)]"
            style={{ offsetPath: `path("${path}")`, offsetRotate: "0deg" }}
            initial={{ offsetDistance: reverse ? "100%" : "0%", opacity: 0 }}
            animate={{ offsetDistance: reverse ? "0%" : "100%", opacity: [0, 1, 1, 0] }}
            transition={{ duration, delay: delay + (i * duration) / particles, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
    </>
  );
}
