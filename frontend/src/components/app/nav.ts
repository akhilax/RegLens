import {
  Activity,
  BookOpenText,
  ClipboardCheck,
  FlaskConical,
  Gauge,
  Link2,
  ListOrdered,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";

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
  { to: "/app/knowledge", label: "Knowledge Base", icon: BookOpenText, shortcut: "G K", description: "Versioned regulations and diffs" },
  { to: "/app/ask", label: "Ask the Regulations", icon: MessagesSquare, shortcut: "G Q", description: "RAG Q&A with citations" },
  { to: "/app/audit", label: "Audit Log", icon: Link2, shortcut: "G L", description: "Hash-chained, tamper-evident log" },
  { to: "/app/evaluation", label: "Evaluation", icon: FlaskConical, shortcut: "G E", description: "Precision, recall and guardrail metrics" },
];
