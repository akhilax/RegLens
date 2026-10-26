import { Command, Menu, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/overlay";
import { Kbd } from "@/components/ui/primitives";
import { useUI } from "@/store/ui";
import { Logo } from "./logo";
import { NavList } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";

export function Topbar() {
  const setPaletteOpen = useUI((s) => s.setPaletteOpen);
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
        <ThemeToggle />
      </div>
    </header>
  );
}
