"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";

export interface ScorePoint {
  /** 0-based position on the x axis (attempts in chronological order). */
  idx: number;
  /** Short date for the axis, e.g. "Oct 20". */
  dateLabel: string;
  score: number;
  passed: boolean;
  quizTitle: string;
  courseTitle: string;
  attemptNo: number;
}

// One series -> one colour (the brand violet). Pass/fail is carried by marker fill, not hue.
const config = { score: { label: "Score", color: "var(--chart-1)" } } satisfies ChartConfig;

/** Filled dot = passed; hollow dot = not yet. Both carry a 2px surface ring so overlaps stay legible. */
function Marker(props: { cx?: number; cy?: number; payload?: ScorePoint }) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || !payload) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill="var(--card)" />
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={payload.passed ? "var(--color-score)" : "var(--card)"}
        stroke="var(--color-score)"
        strokeWidth={2}
      />
    </g>
  );
}

function ScoreTooltip({ active, payload }: { active?: boolean; payload?: { payload: ScorePoint }[] }) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div className="min-w-44 rounded-xl border bg-white px-3 py-2 text-sm shadow-lg">
      <div className="flex items-center gap-2">
        <span aria-hidden className="h-0.5 w-3.5 rounded-full" style={{ background: "var(--chart-1)" }} />
        <span className="text-xl font-bold tabular-nums text-foreground">{point.score}%</span>
        <span className="text-xs font-medium text-muted-foreground">{point.passed ? "Passed" : "Not yet passed"}</span>
      </div>
      <p className="mt-1 text-xs font-medium text-foreground">{point.quizTitle}</p>
      <p className="text-xs text-muted-foreground">
        {point.courseTitle} · attempt {point.attemptNo} · {point.dateLabel}
      </p>
    </div>
  );
}

export function ScoreHistoryChart({ data, passMark }: { data: ScorePoint[]; passMark: number | null }) {
  return (
    <div>
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <LineChart accessibilityLayer data={data} margin={{ top: 12, right: 24, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
          <XAxis
            dataKey="idx"
            type="number"
            domain={data.length > 1 ? [0, data.length - 1] : [-0.5, 0.5]}
            ticks={data.map((d) => d.idx)}
            tickFormatter={(i: number) => data[i]?.dateLabel ?? ""}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            interval="preserveStartEnd"
            padding={{ left: 16, right: 16 }}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          {passMark !== null && (
            <ReferenceLine
              y={passMark}
              stroke="var(--muted-foreground)"
              strokeWidth={1}
              strokeOpacity={0.6}
              label={{ value: `Pass mark ${passMark}%`, position: "insideBottomRight", fill: "var(--muted-foreground)", fontSize: 12 }}
            />
          )}
          <ChartTooltip cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeOpacity: 0.4 }} content={<ScoreTooltip />} />
          <Line
            dataKey="score"
            type="monotone"
            stroke="var(--color-score)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={<Marker />}
            activeDot={<Marker />}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>

      <p className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <svg width="14" height="14" aria-hidden>
            <circle cx="7" cy="7" r="5" fill="var(--chart-1)" stroke="var(--chart-1)" strokeWidth="2" />
          </svg>
          Passed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="14" height="14" aria-hidden>
            <circle cx="7" cy="7" r="5" fill="white" stroke="var(--chart-1)" strokeWidth="2" />
          </svg>
          Not yet passed
        </span>
      </p>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-medium text-primary">View as table</summary>
        <table className="mt-2 w-full text-left">
          <caption className="sr-only">Quiz scores by attempt</caption>
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1.5 pr-3 font-medium">Date</th>
              <th className="py-1.5 pr-3 font-medium">Quiz</th>
              <th className="py-1.5 pr-3 font-medium">Attempt</th>
              <th className="py-1.5 pr-3 font-medium">Score</th>
              <th className="py-1.5 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.idx} className="border-t">
                <td className="py-1.5 pr-3">{d.dateLabel}</td>
                <td className="py-1.5 pr-3">{d.quizTitle}</td>
                <td className="py-1.5 pr-3 tabular-nums">{d.attemptNo}</td>
                <td className="py-1.5 pr-3 tabular-nums">{d.score}%</td>
                <td className="py-1.5">{d.passed ? "Passed" : "Not yet passed"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
