import { ChevronDown, Command, Menu, Search, UserCheck } from "lucide-react";
import { useState } from "react";
import { useMeta } from "@/api/hooks";
import { Avatar } from "@/components/magic/animated-tooltip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlay";
import { Kbd } from "@/components/ui/primitives";
import { useUI } from "@/store/ui";
import { Logo } from "./logo";
import { NavList } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";

export function ReviewerSwitcher() {
  const { data: meta } = useMeta();
  const reviewer = useUI((s) => s.reviewer);
  const setReviewer = useUI((s) => s.setReviewer);
  const reviewers = meta?.reviewers ?? [];
  const current = reviewers.find((r) => r.id === reviewer) ?? reviewers[0];
  const idx = Math.max(0, reviewers.findIndex((r) => r.id === current?.id));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-full border border-border bg-card/60 py-1 pl-1 pr-2.5 text-left transition-colors hover:bg-accent"
          aria-label="Switch reviewer"
        >
          <Avatar name={current?.name ?? "?"} idx={idx} className="size-7 ring-0" />
          <span className="hidden min-w-0 leading-tight sm:block">
            <span className="block truncate text-xs font-medium">{current?.name ?? "Loading…"}</span>
            <span className="block truncate text-[10px] text-muted-foreground">{current?.role}</span>
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Acting as reviewer (demo)</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {reviewers.map((r, i) => (
          <DropdownMenuItem key={r.id} onSelect={() => setReviewer(r.id)}>
            <Avatar name={r.name} idx={i} className="size-6 ring-0" />
            <span className="flex-1">
              <span className="block text-sm">{r.name}</span>
              <span className="block text-[11px] text-muted-foreground">{r.role}</span>
            </span>
            {r.id === reviewer && <UserCheck className="size-4 text-brand" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Topbar() {
  const setPaletteOpen = useUI((s) => s.setPaletteOpen);
  const { data: meta } = useMeta();
  const [menuOpen, setMenuOpen] = useState(false);
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="glass sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border px-4 sm:px-6">
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setMenuOpen(true)} aria-label="Open navigation">
          <Menu />
        </Button>
        <DialogContent side="bottom" className="p-4 pb-8">
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <DialogDescription className="sr-only">Jump to a section</DialogDescription>
          <div className="mb-3 px-1">
            <Logo />
          </div>
          <NavList onNavigate={() => setMenuOpen(false)} layoutId="nav-active-mobile" />
        </DialogContent>
      </Dialog>
      <div className="md:hidden">
        <Logo compact />
      </div>

      <button
        onClick={() => setPaletteOpen(true)}
        className="group ml-auto flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-background/50 text-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground sm:w-full sm:max-w-sm sm:shrink sm:justify-start sm:px-3 md:ml-0"
        aria-label="Open command palette"
      >
        <Search className="size-4" />
        <span className="hidden truncate sm:inline">Search transactions, decisions, pages…</span>
        <span className="ml-auto hidden items-center gap-1 sm:flex">
          <Kbd>{isMac ? <Command className="size-3" /> : "Ctrl"}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
        {meta && (
          <span className="hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground lg:flex">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-risk-low opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-risk-low" />
            </span>
            <span className="font-mono">{meta.llm_provider}:{meta.llm_model}</span>
          </span>
        )}
        <ThemeToggle />
        <ReviewerSwitcher />
      </div>
    </header>
  );
}
