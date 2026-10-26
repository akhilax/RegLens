import { Activity, ClipboardCheck, Gauge, ListOrdered, type LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  description: string;
}

export const NAV: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: Gauge, shortcut: "G D", description: "KPIs, risk pulse and filing deadlines" },
  { to: "/app/transactions", label: "Transactions", icon: ListOrdered, shortcut: "G T", description: "All transactions with decisions" },
  { to: "/app/analysis", label: "Run Analysis", icon: Activity, shortcut: "G A", description: "Batch analysis with live progress" },
  { to: "/app/review", label: "Review Queue", icon: ClipboardCheck, shortcut: "G R", description: "Human-in-the-loop approvals" },
];
