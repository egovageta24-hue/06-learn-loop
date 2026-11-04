import { useId } from "react";
import { cn } from "@/lib/utils";

/** Cover palettes share one construction (gradient + loop motif) so every course looks like one family. */
const THEMES: Record<string, { from: string; to: string; shape: string }> = {
  violet: { from: "#6D5BD0", to: "#A99BF5", shape: "#FFFFFF" },
  sky: { from: "#3B82F6", to: "#8FC1FF", shape: "#FFFFFF" },
  amber: { from: "#E9A23B", to: "#FFD98A", shape: "#FFFFFF" },
  emerald: { from: "#14A38B", to: "#7EDCC4", shape: "#FFFFFF" },
  rose: { from: "#E0577F", to: "#F8A6BE", shape: "#FFFFFF" },
};

export const COVER_THEMES = Object.keys(THEMES);

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function CourseCover({
  theme,
  seed,
  label,
  className,
}: {
  theme: string;
  /** Anything stable (slug/id) — varies the motif placement deterministically. */
  seed: string;
  label?: string;
  className?: string;
}) {
  const gid = useId();
  const t = THEMES[theme] ?? THEMES.violet;
  const h = hash(seed);
  const cx = 250 + (h % 110);
  const cy = 40 + ((h >> 8) % 90);
  const r = 70 + ((h >> 16) % 30);
  const dash = 120 + ((h >> 4) % 140);

  return (
    <svg
      viewBox="0 0 400 225"
      preserveAspectRatio="xMidYMid slice"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("block h-full w-full", className)}
    >
      <defs>
        <linearGradient id={`${gid}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={t.from} />
          <stop offset="1" stopColor={t.to} />
        </linearGradient>
      </defs>
      <rect width="400" height="225" fill={`url(#${gid}-bg)`} />
      <circle cx={cx} cy={cy} r={r} fill={t.shape} opacity="0.14" />
      <circle cx={cx - 150} cy={cy + 110} r={r * 0.6} fill={t.shape} opacity="0.1" />
      {/* the "loop": an open ring echoing the progress ring used across the product */}
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.62}
        fill="none"
        stroke={t.shape}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${dash} 400`}
        opacity="0.85"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <rect x="28" y="150" width="96" height="10" rx="5" fill={t.shape} opacity="0.55" />
      <rect x="28" y="170" width="150" height="10" rx="5" fill={t.shape} opacity="0.3" />
    </svg>
  );
}
