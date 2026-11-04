import { cn } from "@/lib/utils";

/** Orange is reserved for progress across the product — rings, bars, next-step highlights. */

export function ProgressBar({
  value,
  label,
  className,
  showValue = false,
}: {
  value: number;
  label: string;
  className?: string;
  showValue?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-orange-100"
      >
        <div
          className="h-full rounded-full bg-orange-500 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {showValue && <span className="w-10 text-right text-sm font-semibold tabular-nums text-orange-600">{pct}%</span>}
    </div>
  );
}

export function ProgressRing({
  value,
  size = 64,
  stroke = 7,
  label,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-orange-100" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          className="stroke-orange-500 transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute text-sm font-bold tabular-nums text-slate-800">{pct}%</span>
    </div>
  );
}
