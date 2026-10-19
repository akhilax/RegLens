const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrPaise = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const num = new Intl.NumberFormat("en-IN");

/** ₹12,34,567 — Indian digit grouping. */
export function formatINR(value: number, withPaise = false): string {
  return (withPaise ? inrPaise : inr).format(value);
}

/** Compact lakh/crore: ₹12.5 L, ₹1.24 Cr. */
export function formatINRCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e7) return `₹${(value / 1e7).toFixed(abs >= 1e9 ? 0 : 2)} Cr`;
  if (abs >= 1e5) return `₹${(value / 1e5).toFixed(abs >= 1e6 ? 1 : 2)} L`;
  return formatINR(value);
}

export function formatNumber(value: number): string {
  return num.format(value);
}

export function formatPct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDate(iso: string | Date, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" }) {
  return new Date(iso).toLocaleDateString("en-IN", opts);
}

export function formatDateTime(iso: string | Date) {
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function daysUntil(isoDate: string, now = new Date()): number {
  const target = new Date(`${isoDate}T23:59:59`);
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

export function countdownLabel(isoDate: string): string {
  const d = daysUntil(isoDate);
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return "due today";
  if (d === 1) return "due tomorrow";
  return `in ${d}d`;
}

export function shortHash(hash: string, n = 8): string {
  return hash.length > n * 2 ? `${hash.slice(0, n)}…${hash.slice(-4)}` : hash;
}

export const STATUS_LABEL: Record<string, string> = {
  auto_cleared: "Auto-cleared",
  logged: "Logged",
  pending_review: "Pending review",
  in_review: "In review",
  awaiting_second_approval: "Awaiting 2nd approver",
  approved: "Approved",
  rejected: "Rejected",
  needs_re_review: "Needs re-review",
};

export const RULE_LABEL: Record<string, string> = {
  "R-CTR": "Cash > ₹10L",
  "R-STRUCT": "Structuring",
  "R-CBWTR": "Cross-border wire",
  "R-NPO": "NPO receipt",
  "R-CASH-RECEIPT": "Cash ≥ ₹2L / person",
  "R-PAN": "Cash w/o PAN",
  "R-LRS": "LRS breach",
  "R-HRJ": "High-risk jurisdiction",
  "R-PEP": "PEP",
  "R-KYC-DUE": "KYC overdue",
};
