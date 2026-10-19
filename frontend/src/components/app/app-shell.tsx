import { AnimatePresence, m } from "motion/react";
import { cloneElement, Suspense, useEffect, useRef } from "react";
import { useLocation, useNavigate, useOutlet } from "react-router";
import { pageTransition } from "@/lib/motion";
import { CommandPalette } from "./command-palette";
import { NAV } from "./nav";
import { PageSkeleton } from "./page-skeleton";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/** "G then D" style navigation shortcuts. */
function useGoShortcuts() {
  const navigate = useNavigate();
  const pending = useRef(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || t?.closest("input, textarea, select, [contenteditable=true]")) return;
      const key = e.key.toUpperCase();
      if (key === "G") {
        pending.current = Date.now();
        return;
      }
      if (Date.now() - pending.current < 900) {
        const item = NAV.find((n) => n.shortcut === `G ${key}`);
        if (item) {
          e.preventDefault();
          navigate(item.to);
        }
        pending.current = 0;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
}

export function AppShell() {
  const location = useLocation();
  const outlet = useOutlet();
  useGoShortcuts();
  // Keep detail pages under the same section key so tab-like transitions feel right.
  const key = location.pathname.split("/").slice(0, 3).join("/");

  return (
    <div className="app-backdrop flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-popover focus:px-3 focus:py-2">
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main id="main" className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <AnimatePresence mode="wait" initial={false}>
            <m.div key={key} variants={pageTransition} initial="initial" animate="animate" exit="exit">
              <Suspense fallback={<PageSkeleton />}>{outlet && cloneElement(outlet, { key })}</Suspense>
            </m.div>
          </AnimatePresence>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
