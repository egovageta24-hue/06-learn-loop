"use client";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";

export interface FunnelPoint {
  label: string;
  title: string;
  completed: number;
}

const config = { completed: { label: "Completed", color: "var(--chart-1)" } } satisfies ChartConfig;

function FunnelTooltip({
  active,
  payload,
  enrolled,
}: {
  active?: boolean;
  payload?: { payload: FunnelPoint }[];
  enrolled: number;
}) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  const pct = enrolled > 0 ? Math.round((p.completed / enrolled) * 100) : 0;
  return (
    <div className="min-w-44 rounded-xl border bg-white px-3 py-2 text-sm shadow-lg">
      <div className="flex items-center gap-2">
        <span aria-hidden className="h-0.5 w-3.5 rounded-full" style={{ background: "var(--chart-1)" }} />
        <span className="text-xl font-bold tabular-nums">{p.completed}</span>
        <span className="text-xs text-muted-foreground">
          of {enrolled} learners ({pct}%)
        </span>
      </div>
      <p className="mt-1 text-xs font-medium">
        {p.label} · {p.title}
      </p>
    </div>
  );
}

export function LessonFunnelChart({ data, enrolled }: { data: FunnelPoint[]; enrolled: number }) {
  return (
    <div>
      <ChartContainer config={config} className="aspect-auto h-60 w-full">
        <BarChart accessibilityLayer data={data} margin={{ top: 20, right: 8, bottom: 4, left: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            allowDecimals={false}
            domain={[0, Math.max(enrolled, 1)]}
            tickLine={false}
            axisLine={false}
            width={32}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <ChartTooltip cursor={{ fill: "var(--secondary)", opacity: 0.6 }} content={<FunnelTooltip enrolled={enrolled} />} />
          <Bar dataKey="completed" fill="var(--color-completed)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
            <LabelList dataKey="completed" position="top" fill="var(--foreground)" fontSize={12} />
          </Bar>
        </BarChart>
      </ChartContainer>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-medium text-primary">View as table</summary>
        <table className="mt-2 w-full text-left">
          <caption className="sr-only">Learners who completed each lesson</caption>
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1.5 pr-3 font-medium">Lesson</th>
              <th className="py-1.5 pr-3 font-medium">Title</th>
              <th className="py-1.5 font-medium">Completed</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-t">
                <td className="py-1.5 pr-3 tabular-nums">{d.label}</td>
                <td className="py-1.5 pr-3">{d.title}</td>
                <td className="py-1.5 tabular-nums">
                  {d.completed} / {enrolled}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
