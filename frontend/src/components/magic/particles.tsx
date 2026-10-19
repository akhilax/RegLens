// Rebuilt from 21st.dev "Particles" by dillionverma (https://21st.dev/@dillionverma/components/particles)
import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface Dot {
  x: number;
  y: number;
  dx: number;
  dy: number;
  r: number;
  a: number;
  ta: number;
}

export function Particles({ className, quantity = 70, color = "167, 139, 250" }: { className?: string; quantity?: number; color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let raf = 0;
    const mouse = { x: -9999, y: -9999 };
    let dots: Dot[] = [];

    const make = (): Dot => ({
      x: Math.random() * w,
      y: Math.random() * h,
      dx: (Math.random() - 0.5) * 0.18,
      dy: (Math.random() - 0.5) * 0.18,
      r: Math.random() * 1.4 + 0.4,
      a: 0,
      ta: Math.random() * 0.55 + 0.15,
    });
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = Array.from({ length: quantity }, make);
    };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        const mx = mouse.x - d.x;
        const my = mouse.y - d.y;
        const dist = Math.hypot(mx, my);
        if (dist < 140) {
          d.x -= (mx / dist) * 0.35;
          d.y -= (my / dist) * 0.35;
        }
        d.x += d.dx;
        d.y += d.dy;
        d.a += (d.ta - d.a) * 0.02;
        if (d.x < -5 || d.x > w + 5 || d.y < -5 || d.y > h + 5) Object.assign(d, make(), { a: 0 });
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color}, ${d.a})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    resize();
    if (reduce) {
      for (const d of dots) d.a = d.ta;
      draw();
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(draw);
    }
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, [quantity, color, reduce]);

  return <canvas ref={canvasRef} aria-hidden className={cn("pointer-events-none absolute inset-0 h-full w-full", className)} />;
}
