// Animated theme switch with a circular View-Transitions reveal (falls back to a crossfade).
import { AnimatePresence, m } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { flushSync } from "react-dom";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { applyTheme, useUI } from "@/store/ui";

type DocWithVT = Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };

export function ThemeToggle() {
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);
  const ref = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    const doc = document as DocWithVT;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const commit = () => {
      flushSync(() => setTheme(next));
      applyTheme(next);
    };
    if (!doc.startViewTransition || reduce || !ref.current) {
      document.documentElement.animate([{ opacity: 0.6 }, { opacity: 1 }], { duration: 220 });
      commit();
      return;
    }
    const { top, left, width, height } = ref.current.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    doc.startViewTransition(commit).ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 650, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    });
  };

  return (
    <Button ref={ref} variant="ghost" size="icon-sm" onClick={toggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
      <AnimatePresence mode="wait" initial={false}>
        <m.span
          key={theme}
          initial={{ rotate: -90, scale: 0, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
          className="grid place-items-center"
        >
          {theme === "dark" ? <Moon /> : <Sun />}
        </m.span>
      </AnimatePresence>
    </Button>
  );
}
