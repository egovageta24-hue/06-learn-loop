import Link from "next/link";
import { CourseCover } from "@/components/brand/course-cover";
import { ProgressBar } from "@/components/brand/progress";
import { Badge } from "@/components/ui/badge";
import type { LearnerCourse } from "@/lib/queries/learner";
import { NextActionLink } from "./next-action-link";

export function EnrolledCourseCard({ course }: { course: LearnerCourse }) {
  const { outline, progress, next } = course;
  const complete = progress.isComplete;
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border bg-white shadow-xs">
      <div className="aspect-[16/6] overflow-hidden">
        <CourseCover theme={course.coverTheme} seed={outline.slug} />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{course.category}</Badge>
          {complete && <Badge className="bg-orange-500 text-white">Completed</Badge>}
        </div>
        <h3 className="text-lg font-bold leading-snug tracking-tight">
          <Link href={`/courses/${outline.slug}`} className="hover:underline">
            {outline.title}
          </Link>
        </h3>
        <div>
          <ProgressBar value={progress.percent} label={`${outline.title} progress`} showValue />
          <p className="mt-1 text-xs text-muted-foreground">
            {progress.doneUnits} of {progress.totalUnits} steps complete
          </p>
        </div>
        <NextActionLink action={next} className="mt-auto w-full justify-between" />
      </div>
    </article>
  );
}
