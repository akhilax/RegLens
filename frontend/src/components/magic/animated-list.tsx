// Rebuilt from 21st.dev "Animated List" by dillionverma (https://21st.dev/@dillionverma/components/animated-list)
import { AnimatePresence, m } from "motion/react";
import type { ReactNode } from "react";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface AnimatedListItem {
  key: string | number;
  node: ReactNode;
}

/** Newest-first list where each new item springs in from the top and pushes the rest down. */
export function AnimatedList({ items, className, max = 50 }: { items: AnimatedListItem[]; className?: string; max?: number }) {
  return (
    <ul className={cn("flex flex-col gap-2", className)} aria-live="polite">
      <AnimatePresence initial={false}>
        {items.slice(0, max).map((item) => (
          <m.li
            key={item.key}
            layout
            initial={{ opacity: 0, y: -18, scale: 0.96, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={spring.gentle}
          >
            {item.node}
          </m.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
