// Recharts lives in its own lazily-loaded chunk.
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Stats } from "@/api/client";
import { formatDate, RULE_LABEL } from "@/lib/format";

const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border-strong bg-popover px-3 py-2 text-xs shadow-lift">
      <div className="mb-1 font-medium">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}
          <span className="ml-auto pl-4 font-mono text-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function ActivityChart({ daily }: { daily: Stats["daily"] }) {
  // Weekly buckets keep the area readable over a 3-month window.
  const weeks: { label: string; Transactions: number; Flagged: number }[] = [];
  daily.forEach((d, i) => {
    if (i % 7 === 0) weeks.push({ label: formatDate(d.date, { day: "2-digit", month: "short" }), Transactions: 0, Flagged: 0 });
    const w = weeks[weeks.length - 1];
    w.Transactions += d.transactions;
    w.Flagged += d.flagged;
  });
  return (
    <div className="h-56 w-full" role="img" aria-label="Weekly transactions and flagged transactions">
      <ResponsiveContainer>
        <AreaChart data={weeks} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="fill-tx" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fill-fl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" {...axis} minTickGap={24} />
          <YAxis {...axis} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border-strong)" }} />
          <Area type="monotone" dataKey="Transactions" stroke="var(--chart-1)" strokeWidth={2} fill="url(#fill-tx)" animationDuration={1200} />
          <Area type="monotone" dataKey="Flagged" stroke="var(--chart-2)" strokeWidth={2} fill="url(#fill-fl)" animationDuration={1400} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RuleChart({ byRule }: { byRule: Record<string, number> }) {
  const data = Object.entries(byRule).map(([id, n]) => ({ id, name: RULE_LABEL[id] ?? id, Hits: n }));
  return (
    <div className="w-full" style={{ height: Math.max(160, data.length * 28) }} role="img" aria-label="Rule hits by rule">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap={6}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis type="category" dataKey="name" {...axis} width={130} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--accent)", opacity: 0.4 }} />
          <Bar dataKey="Hits" fill="var(--chart-1)" radius={[0, 4, 4, 0]} animationDuration={1100} label={{ position: "right", fill: "var(--muted-foreground)", fontSize: 11 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
