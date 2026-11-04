import { BookOpen, Clock, Users } from "lucide-react";
import Link from "next/link";
import { CourseCover } from "@/components/brand/course-cover";
import { Badge } from "@/components/ui/badge";
import { formatMinutes, levelLabel, plural } from "@/lib/format";
import type { CatalogCourse } from "@/lib/queries/catalog";

export function CourseCard({ course, enrolled }: { course: CatalogCourse; enrolled?: boolean }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-xs transition-shadow focus-within:shadow-md hover:shadow-md">
      <div className="aspect-[16/9] overflow-hidden">
        <CourseCover
          theme={course.coverTheme}
          seed={course.slug}
          className="transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{course.category}</Badge>
          <Badge variant="outline">{levelLabel[course.level]}</Badge>
          {enrolled && <Badge className="bg-orange-500 text-white">Enrolled</Badge>}
        </div>
        <h3 className="text-lg font-bold leading-snug tracking-tight">
          {/* The whole card is the link target via the stretched ::after */}
          <Link
            href={`/courses/${course.slug}`}
            className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-2xl focus-visible:after:ring-3 focus-visible:after:ring-ring/60"
          >
            {course.title}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{course.summary}</p>
        <dl className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Lessons</dt>
            <BookOpen className="size-3.5" aria-hidden />
            <dd>{plural(course.lessonCount, "lesson")}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Duration</dt>
            <Clock className="size-3.5" aria-hidden />
            <dd>{formatMinutes(course.estimatedMinutes)}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Learners</dt>
            <Users className="size-3.5" aria-hidden />
            <dd>{plural(course.learnerCount, "learner")}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          with <span className="font-semibold text-foreground">{course.instructorName}</span>
        </p>
      </div>
    </article>
  );
}
