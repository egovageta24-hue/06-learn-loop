import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-bold tracking-tight text-slate-900", className)}>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" className="fill-violet-600" />
        <circle cx="16" cy="16" r="7" fill="none" stroke="white" strokeWidth="3" strokeOpacity="0.45" />
        <circle
          cx="16"
          cy="16"
          r="7"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="30 100"
          transform="rotate(-90 16 16)"
          className="stroke-orange-400"
        />
      </svg>
      <span className="text-lg">LearnLoop</span>
    </Link>
  );
}
