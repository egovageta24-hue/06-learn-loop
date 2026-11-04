import { CircleCheck, CircleDashed, Clock, LifeBuoy, RotateCcw, Sparkles } from "lucide-react";
import type { LearnerStatus } from "@/lib/learning/risk";
import { statusLabel } from "@/lib/learning/risk";
import { cn } from "@/lib/utils";

const STYLE: Record<LearnerStatus, { icon: typeof Clock; className: string }> = {
  completed: { icon: CircleCheck, className: "bg-violet-100 text-violet-800" },
  on_track: { icon: Sparkles, className: "bg-emerald-100 text-emerald-800" },
  review_required: { icon: RotateCcw, className: "bg-sky-100 text-sky-800" },
  not_started: { icon: CircleDashed, className: "bg-slate-100 text-slate-700" },
  inactive: { icon: Clock, className: "bg-amber-100 text-amber-900" },
  escalated: { icon: LifeBuoy, className: "bg-red-100 text-red-800" },
};

/** Icon + label, so status is never carried by colour alone. */
export function StatusBadge({ status, className }: { status: LearnerStatus; className?: string }) {
  const { icon: Icon, className: tone } = STYLE[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", tone, className)}>
      <Icon className="size-3.5" aria-hidden />
      {statusLabel[status]}
    </span>
  );
}
