// Rebuilt from 21st.dev "Number Ticker" by dillionverma (https://21st.dev/@dillionverma/components/number-ticker)
import { useInView, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface NumberTickerProps {
  value: number;
  format?: (n: number) => string;
  decimals?: number;
  delay?: number;
  className?: string;
}

export function NumberTicker({ value, format, decimals = 0, delay = 0, className }: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { damping: 42, stiffness: 120 });
  const inView = useInView(ref, { once: true, margin: "0px" });
  const fmt = useRef(format);
  useEffect(() => {
    fmt.current = format;
  }, [format]);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      mv.jump(value);
      spring.jump(value);
      return;
    }
    const t = setTimeout(() => mv.set(value), delay * 1000);
    return () => clearTimeout(t);
  }, [inView, value, delay, reduce, mv, spring]);

  useEffect(
    () =>
      spring.on("change", (latest) => {
        if (!ref.current) return;
        const n = Number(latest.toFixed(decimals));
        ref.current.textContent = fmt.current ? fmt.current(n) : n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      }),
    [spring, decimals],
  );

  const initial = format ? format(0) : (0).toFixed(decimals);
  return (
    <span ref={ref} className={cn("tabular inline-block tracking-tight", className)} aria-label={String(value)}>
      {initial}
    </span>
  );
}
