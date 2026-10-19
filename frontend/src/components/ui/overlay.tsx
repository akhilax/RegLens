import { Dialog as D, DropdownMenu as DM, Tooltip as T } from "radix-ui";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/* ---------------- Dialog / Sheet ---------------- */
export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;
export const DialogTitle = ({ className, ...p }: React.ComponentProps<typeof D.Title>) => (
  <D.Title className={cn("text-base font-semibold tracking-tight", className)} {...p} />
);
export const DialogDescription = ({ className, ...p }: React.ComponentProps<typeof D.Description>) => (
  <D.Description className={cn("text-sm text-muted-foreground", className)} {...p} />
);

export function DialogContent({
  className,
  children,
  side,
  ...props
}: React.ComponentProps<typeof D.Content> & { side?: "right" | "bottom" }) {
  const sheet = side === "right"
    ? "right-0 top-0 h-dvh w-full max-w-xl border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right"
    : side === "bottom"
      ? "bottom-0 left-0 max-h-[85dvh] w-full rounded-t-2xl border-t data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom"
      : "left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border " +
        "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95";
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <D.Content
        className={cn(
          "fixed z-50 bg-popover p-6 text-popover-foreground shadow-lift outline-none duration-300",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          sheet,
          className,
        )}
        {...props}
      >
        {children}
        <D.Close
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}

/* ---------------- Tooltip ---------------- */
export const TooltipProvider = T.Provider;
export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <T.Root delayDuration={250}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-xs rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-soft data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95"
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

/* ---------------- Dropdown ---------------- */
export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;
export function DropdownMenuContent({ className, ...props }: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        sideOffset={8}
        className={cn(
          "z-50 min-w-56 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lift",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2",
          className,
        )}
        {...props}
      />
    </DM.Portal>
  );
}
export function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof DM.Item>) {
  return (
    <DM.Item
      className={cn(
        "flex cursor-default select-none items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none",
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}
export const DropdownMenuLabel = ({ className, ...p }: React.ComponentProps<typeof DM.Label>) => (
  <DM.Label className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)} {...p} />
);
export const DropdownMenuSeparator = () => <DM.Separator className="my-1 h-px bg-border" />;
