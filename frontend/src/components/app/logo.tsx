import { m } from "motion/react";
import { useId } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  const gid = `logo-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.78 0.15 290)" />
          <stop offset="1" stopColor="oklch(0.6 0.22 270)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="oklch(0.18 0.03 280)" />
      <circle cx="14.5" cy="14.5" r="7" fill="none" stroke={`url(#${gid})`} strokeWidth="3" />
      <path d="M19.5 19.5 25 25" stroke={`url(#${gid})`} strokeWidth="3.2" strokeLinecap="round" />
      <m.path
        d="M11.5 15l2.2 2.2 4-4.4"
        fill="none"
        stroke="#ece8ff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
      />
    </svg>
  );
}

export function Logo({ compact = false, to = "/" }: { compact?: boolean; to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 rounded-lg" aria-label="RegLens home">
      <LogoMark />
      {!compact && (
        <span className="text-[15px] font-semibold tracking-tight">
          Reg<span className="text-brand">Lens</span>
        </span>
      )}
    </Link>
  );
}
