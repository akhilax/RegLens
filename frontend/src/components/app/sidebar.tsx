import { AnimatePresence, m } from "motion/react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NavLink, useLocation } from "react-router";
import { useQueue } from "@/api/hooks";
import { Tooltip } from "@/components/ui/overlay";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useUI } from "@/store/ui";
import { Logo } from "./logo";
import { NAV } from "./nav";

function isActive(pathname: string, to: string) {
  return to === "/app" ? pathname === "/app" || pathname === "/app/" : pathname.startsWith(to);
}

export function NavList({ collapsed = false, onNavigate, layoutId = "nav-active" }: { collapsed?: boolean; onNavigate?: () => void; layoutId?: string }) {
  const { pathname } = useLocation();
  const { data: queue } = useQueue();
  const pending = queue?.filter((d) => ["pending_review", "in_review", "awaiting_second_approval"].includes(d.status)).length;

  return (
    <ul className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active = isActive(pathname, item.to);
        const Icon = item.icon;
        const link = (
          <NavLink
            to={item.to}
            end={item.to === "/app"}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium outline-none transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              collapsed && "justify-center px-0",
            )}
          >
            {active && (
              <m.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg border border-border-strong bg-accent/70 shadow-soft"
                transition={spring.snappy}
              />
            )}
            <Icon className={cn("relative size-[18px] shrink-0 transition-colors", active && "text-brand")} aria-hidden />
            <AnimatePresence initial={false}>
              {!collapsed && (
                <m.span
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.15 }}
                  className="relative truncate"
                >
                  {item.label}
                </m.span>
              )}
            </AnimatePresence>
            {item.to === "/app/review" && !!pending && (
              <span
                className={cn(
                  "relative ml-auto rounded-full bg-brand px-1.5 text-[10px] font-semibold leading-4 text-white tabular",
                  collapsed && "absolute right-1 top-1 ml-0 px-1",
                )}
                aria-label={`${pending} awaiting review`}
              >
                {pending}
              </span>
            )}
          </NavLink>
        );
        return <li key={item.to}>{collapsed ? <Tooltip content={item.label} side="right">{link}</Tooltip> : link}</li>;
      })}
    </ul>
  );
}

export function Sidebar() {
  const collapsed = useUI((s) => s.sidebarCollapsed);
  const toggle = useUI((s) => s.toggleSidebar);
  return (
    <m.aside
      initial={false}
      animate={{ width: collapsed ? 68 : 240 }}
      transition={spring.snappy}
      className="glass sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-border md:flex"
      aria-label="Primary"
    >
      <div className={cn("flex h-14 items-center gap-2 px-4", collapsed && "justify-center px-0")}>
        <Logo compact={collapsed} />
      </div>
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
        <NavList collapsed={collapsed} />
      </nav>
      <div className={cn("border-t border-border p-3", collapsed && "flex justify-center")}>
        <button
          onClick={toggle}
          className="flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <PanelLeftOpen className="mx-auto size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </m.aside>
  );
}
