// Rebuilt from 21st.dev "Marquee" by dillionverma (https://21st.dev/@dillionverma/components/marquee)
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Marquee({
  children,
  className,
  reverse = false,
  pauseOnHover = true,
  repeat = 3,
  duration = 40,
}: {
  children: ReactNode;
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  repeat?: number;
  duration?: number;
}) {
  return (
    <div
      style={{ "--duration": `${duration}s`, "--gap": "1rem" } as CSSProperties}
      className={cn("group flex overflow-hidden p-2 [gap:var(--gap)]", className)}
    >
      {Array.from({ length: repeat }).map((_, i) => (
        <div
          key={i}
          aria-hidden={i > 0}
          className={cn(
            "flex shrink-0 justify-around [gap:var(--gap)] animate-marquee",
            reverse && "[animation-direction:reverse]",
            pauseOnHover && "group-hover:[animation-play-state:paused]",
          )}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
