import { ChevronDown, UserCheck } from "lucide-react";
import { useMeta } from "@/api/hooks";
import { Avatar } from "@/components/magic/animated-tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlay";
import { useUI } from "@/store/ui";

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
