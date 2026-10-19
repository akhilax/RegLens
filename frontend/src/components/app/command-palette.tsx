import { Command } from "cmdk";
import { AnimatePresence, m } from "motion/react";
import { FileText, Hash, Moon, Receipt, Search, Sun } from "lucide-react";
import { Dialog as D } from "radix-ui";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { api, type SearchHit } from "@/api/client";
import { spring } from "@/lib/motion";
import { applyTheme, useUI } from "@/store/ui";
import { NAV } from "./nav";

const KIND_ICON = { transaction: Receipt, decision: Hash, regulation: FileText } as const;

export function CommandPalette() {
  const open = useUI((s) => s.paletteOpen);
  const setOpen = useUI((s) => s.setPaletteOpen);
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUI.getState().paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(() => {
      api.search(q).then((h) => !cancelled && setHits(h)).catch(() => !cancelled && setHits([]));
    }, 140);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const go = (to: string) => {
    setOpen(false);
    setQuery("");
    setHits([]);
    navigate(to);
  };
  const visibleHits = query.trim().length >= 2 ? hits : [];

  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <m.div
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </D.Overlay>
            <D.Content asChild forceMount aria-describedby={undefined}>
              <m.div
                className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border-strong bg-popover shadow-lift"
                initial={{ opacity: 0, scale: 0.96, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -6 }}
                transition={spring.snappy}
              >
                <D.Title className="sr-only">Command palette</D.Title>
                <Command label="Command palette" shouldFilter={true} className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground">
                  <div className="flex items-center gap-2 border-b border-border px-4">
                    <Search className="size-4 text-muted-foreground" aria-hidden />
                    <Command.Input
                      value={query}
                      onValueChange={setQuery}
                      autoFocus
                      placeholder="Type a page, transaction ID (T00042) or decision #…"
                      className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <Command.List className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
                    <Command.Empty className="py-8 text-center text-sm text-muted-foreground">No results.</Command.Empty>
                    {visibleHits.length > 0 && (
                      <Command.Group heading="Results">
                        {visibleHits.map((h) => {
                          const Icon = KIND_ICON[h.kind];
                          return (
                            <PaletteItem key={`${h.kind}-${h.id}`} value={`${h.title} ${h.subtitle} ${query}`} onSelect={() => go(h.href)}>
                              <Icon className="size-4 text-brand" />
                              <span className="flex-1 truncate">{h.title}</span>
                              <span className="truncate text-xs text-muted-foreground">{h.subtitle}</span>
                            </PaletteItem>
                          );
                        })}
                      </Command.Group>
                    )}
                    <Command.Group heading="Pages">
                      {NAV.map((n) => (
                        <PaletteItem key={n.to} value={`${n.label} ${n.description}`} onSelect={() => go(n.to)}>
                          <n.icon className="size-4 text-muted-foreground" />
                          <span className="flex-1">{n.label}</span>
                          <span className="hidden text-xs text-muted-foreground sm:block">{n.description}</span>
                        </PaletteItem>
                      ))}
                      <PaletteItem value="Landing page home" onSelect={() => go("/")}>
                        <FileText className="size-4 text-muted-foreground" />
                        <span className="flex-1">Landing page</span>
                      </PaletteItem>
                    </Command.Group>
                    <Command.Group heading="Preferences">
                      <PaletteItem
                        value="Toggle theme dark light mode"
                        onSelect={() => {
                          const next = theme === "dark" ? "light" : "dark";
                          setTheme(next);
                          applyTheme(next);
                          setOpen(false);
                        }}
                      >
                        {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
                        <span>Switch to {theme === "dark" ? "light" : "dark"} mode</span>
                      </PaletteItem>
                    </Command.Group>
                  </Command.List>
                </Command>
              </m.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}

function PaletteItem({ children, value, onSelect }: { children: React.ReactNode; value: string; onSelect: () => void }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
    >
      {children}
    </Command.Item>
  );
}
