import { ArrowRight, BookOpen, ListChecks, PartyPopper, RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { NextAction } from "@/lib/learning/next-action";
import { cn } from "@/lib/utils";

const ICONS = {
  start_lesson: BookOpen,
  resume_lesson: BookOpen,
  take_quiz: ListChecks,
  resume_quiz: ListChecks,
  review_remediation: TriangleAlert,
  retake_quiz: RotateCcw,
  course_complete: PartyPopper,
  no_content: BookOpen,
} as const;

/** The one button that tells a learner what to do next. Used everywhere a course is shown. */
export function NextActionLink({
  action,
  size = "lg",
  className,
}: {
  action: NextAction;
  size?: "default" | "lg" | "xl";
  className?: string;
}) {
  const Icon = ICONS[action.type];
  const attention = action.type === "review_remediation";
  return (
    <Link
      href={action.href}
      className={cn(
        buttonVariants({ size, variant: attention ? "outline" : "default" }),
        attention && "border-orange-400 bg-orange-50 text-orange-900 hover:bg-orange-100",
        className,
      )}
    >
      <Icon data-icon="inline-start" />
      <span className="truncate">{action.label}</span>
      <ArrowRight data-icon="inline-end" />
    </Link>
  );
}
