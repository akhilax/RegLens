// Rebuilt from 21st.dev "Shimmer Button" by dillionverma (https://21st.dev/@dillionverma/components/shimmer-button)
import { m } from "motion/react";
import { type CSSProperties, forwardRef, type ReactNode } from "react";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface ShimmerButtonProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  shimmerColor?: string;
  background?: string;
  disabled?: boolean;
}

export const ShimmerButton = forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  ({ children, className, onClick, type = "button", shimmerColor = "#ffffff", background, disabled }, ref) => (
    <m.button
      ref={ref}
      type={type}
      disabled={disabled}
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={spring.snappy}
      style={
        {
          "--spread": "90deg",
          "--shimmer-color": shimmerColor,
          "--radius": "999px",
          "--speed": "3s",
          "--cut": "0.08em",
          "--bg": background ?? "linear-gradient(135deg, oklch(0.5 0.25 288), oklch(0.42 0.2 265))",
        } as CSSProperties
      }
      className={cn(
        "group relative z-0 flex cursor-pointer items-center justify-center gap-2 overflow-hidden whitespace-nowrap",
        "rounded-[var(--radius)] border border-white/15 px-6 py-3 font-medium text-white [background:var(--bg)]",
        "shadow-[0_10px_40px_-10px_var(--brand-glow)] disabled:opacity-50",
        className,
      )}
    >
      {/* spark container */}
      <div className="-z-30 blur-[2px] absolute inset-0 overflow-visible [container-type:size]">
        <div className="absolute inset-0 h-[100cqh] animate-shimmer-slide [aspect-ratio:1] [border-radius:0] [mask:none]">
          <div className="absolute -inset-full w-auto rotate-0 animate-spin-around [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))] [translate:0_0]" />
        </div>
      </div>
      <span className="relative z-10 flex items-center gap-2">{children}</span>
      {/* highlight */}
      <div className="absolute inset-0 rounded-[var(--radius)] shadow-[inset_0_-8px_10px_#ffffff1f] transition-all duration-300 group-hover:shadow-[inset_0_-6px_10px_#ffffff3f]" />
      {/* backdrop */}
      <div className="absolute -z-20 [background:var(--bg)] [border-radius:var(--radius)] [inset:var(--cut)]" />
    </m.button>
  ),
);
ShimmerButton.displayName = "ShimmerButton";
