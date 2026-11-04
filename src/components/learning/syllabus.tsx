import { CircleCheck, CirclePlay, FileText, ListChecks, Lock } from "lucide-react";
import Link from "next/link";
import type { CourseOutline } from "@/lib/queries/learning";
import type { CourseProgress } from "@/lib/learning/progress";
import type { EnrollmentState } from "@/lib/learning/types";
import { cn } from "@/lib/utils";
import { plural } from "@/lib/format";

/**
 * The module/lesson outline. Without `state` it's a plain preview (course
 * detail for visitors); with `state` it shows completion and locked modules and
 * links into the player.
 */
export function Syllabus({
  outline,
  progress,
  state,
  currentLessonId,
}: {
  outline: CourseOutline;
  progress?: CourseProgress;
  state?: EnrollmentState;
  currentLessonId?: string;
}) {
  const enrolled = Boolean(state && progress);
  const done = new Set(state?.completedLessonIds ?? []);
  const passed = new Set(state?.passedQuizIds ?? []);
  const modules = [...outline.modules].sort((a, b) => a.position - b.position);

  return (
    <ol className="space-y-4">
      {modules.map((m, mi) => {
        const mp = progress?.modules.find((p) => p.moduleId === m.id);
        const locked = enrolled && mp?.status === "locked";
        const items = [...m.lessons].sort((a, b) => a.position - b.position);

        return (
          <li key={m.id} className="overflow-hidden rounded-2xl border bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-secondary/40 px-5 py-3">
              <h3 className="font-bold">
                <span className="text-muted-foreground">Module {mi + 1} · </span>
                {m.title}
              </h3>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {locked && (
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Lock className="size-3.5" aria-hidden /> Pass the previous quiz to unlock
                  </span>
                )}
                {enrolled && mp && !locked && (
                  <span className="font-semibold text-orange-600">
                    {mp.lessonsDone}/{mp.lessonsTotal} lessons
                  </span>
                )}
                {!enrolled && plural(items.length, "lesson")}
              </span>
            </div>

            <ul className={cn("divide-y", locked && "opacity-60")}>
              {items.map((l) => {
                const isDone = done.has(l.id);
                const isCurrent = l.id === currentLessonId;
                const Icon = l.type === "video" ? CirclePlay : FileText;
                const content = (
                  <>
                    {enrolled && isDone ? (
                      <CircleCheck className="size-5 shrink-0 text-orange-500" aria-label="Completed" />
                    ) : (
                      <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                    <span className={cn("flex-1", isCurrent && "font-semibold")}>{l.title}</span>
                    <span className="text-xs text-muted-foreground">{l.durationMin} min</span>
                  </>
                );
                const cls = cn(
                  "flex items-center gap-3 px-5 py-3 text-sm",
                  isCurrent && "bg-orange-50",
                  enrolled && !locked && "transition-colors hover:bg-muted/60",
                );
                return (
                  <li key={l.id}>
                    {enrolled && !locked ? (
                      <Link href={`/learn/${outline.slug}/lessons/${l.id}`} aria-current={isCurrent ? "page" : undefined} className={cls}>
                        {content}
                      </Link>
                    ) : (
                      <div className={cls}>{content}</div>
                    )}
                  </li>
                );
              })}

              {m.quiz && (
                <li>
                  {(() => {
                    const quizDone = passed.has(m.quiz.id);
                    const lessonsDone = mp ? mp.lessonsDone === mp.lessonsTotal : false;
                    const available = enrolled && !locked && lessonsDone;
                    const inner = (
                      <>
                        {quizDone ? (
                          <CircleCheck className="size-5 shrink-0 text-orange-500" aria-label="Passed" />
                        ) : (
                          <ListChecks className="size-5 shrink-0 text-primary" aria-hidden />
                        )}
                        <span className="flex-1 font-medium">{m.quiz.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {plural(m.quiz.questionCount, "question")} · pass at {m.quiz.passScore}%
                        </span>
                      </>
                    );
                    const cls = "flex items-center gap-3 bg-violet-50/60 px-5 py-3 text-sm";
                    return available ? (
                      <Link href={`/learn/${outline.slug}/quizzes/${m.quiz.id}`} className={cn(cls, "transition-colors hover:bg-violet-100/70")}>
                        {inner}
                      </Link>
                    ) : (
                      <div className={cls}>{inner}</div>
                    );
                  })()}
                </li>
              )}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
