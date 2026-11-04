import { ArrowRight, BookOpen, Clock, ListChecks } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { enrollAction } from "@/actions/learning";
import { CourseCover } from "@/components/brand/course-cover";
import { ProgressRing } from "@/components/brand/progress";
import { Syllabus } from "@/components/learning/syllabus";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { formatMinutes, levelLabel, plural } from "@/lib/format";
import { getNextAction } from "@/lib/learning/next-action";
import { computeProgress } from "@/lib/learning/progress";
import { getCourseDetail, getDefaultOrgId } from "@/lib/queries/catalog";
import { getEnrollment, loadEnrollmentState, loadOutline } from "@/lib/queries/learning";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const orgId = (await getCurrentUser())?.orgId ?? (await getDefaultOrgId());
  const course = orgId ? await getCourseDetail(slug, orgId) : null;
  return { title: course?.title ?? "Course" };
}

export default async function CourseDetailPage({ params }: Props) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const orgId = user?.orgId ?? (await getDefaultOrgId());
  if (!orgId) notFound();

  const course = await getCourseDetail(slug, orgId);
  if (!course) notFound();
  const outline = await loadOutline({ id: course.id });
  if (!outline) notFound();

  const enrollment = user ? await getEnrollment(user.id, course.id) : null;
  const state = enrollment ? await loadEnrollmentState(enrollment.id) : undefined;
  const progress = state ? computeProgress(outline, state) : undefined;
  const next = state ? getNextAction(outline, state) : undefined;
  const quizCount = outline.modules.filter((m) => m.quiz).length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-8">
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{course.category}</Badge>
              <Badge variant="outline">{levelLabel[course.level]}</Badge>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{course.title}</h1>
            <p className="max-w-2xl text-lg text-muted-foreground">{course.summary}</p>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <BookOpen className="size-4" aria-hidden /> {plural(course.lessonCount, "lesson")}
              </li>
              <li className="flex items-center gap-1.5">
                <ListChecks className="size-4" aria-hidden /> {plural(quizCount, "quiz", "quizzes")}
              </li>
              <li className="flex items-center gap-1.5">
                <Clock className="size-4" aria-hidden /> {formatMinutes(course.estimatedMinutes)}
              </li>
            </ul>
          </header>

          <div className="aspect-[16/7] overflow-hidden rounded-3xl border">
            <CourseCover theme={course.coverTheme} seed={course.slug} label={`${course.title} cover`} />
          </div>

          <section aria-labelledby="about" className="space-y-2">
            <h2 id="about" className="text-xl font-bold">
              About this course
            </h2>
            <p className="max-w-3xl leading-relaxed text-muted-foreground">{course.description}</p>
            <p className="text-sm text-muted-foreground">
              Taught by <span className="font-semibold text-foreground">{course.instructorName}</span>
            </p>
          </section>

          <section aria-labelledby="syllabus" className="space-y-4">
            <h2 id="syllabus" className="text-xl font-bold">
              Syllabus
            </h2>
            <Syllabus outline={outline} progress={progress} state={state} />
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="space-y-4 rounded-3xl border bg-white p-6 shadow-sm">
            {next && progress ? (
              <>
                <div className="flex items-center gap-4">
                  <ProgressRing value={progress.percent} label={`${course.title} progress`} />
                  <div>
                    <p className="font-bold">{progress.isComplete ? "Course complete" : "You're enrolled"}</p>
                    <p className="text-sm text-muted-foreground">
                      {progress.doneUnits} of {progress.totalUnits} steps done
                    </p>
                  </div>
                </div>
                <Link href={next.href} className={buttonVariants({ size: "xl", className: "w-full" })}>
                  {next.label} <ArrowRight data-icon="inline-end" />
                </Link>
              </>
            ) : user ? (
              <>
                <p className="font-bold">Ready to start?</p>
                <p className="text-sm text-muted-foreground">
                  Enroll and we&apos;ll show you the first lesson — and the next one after that.
                </p>
                <form action={enrollAction.bind(null, course.id)}>
                  <Button type="submit" size="xl" className="w-full">
                    Enroll in this course
                  </Button>
                </form>
              </>
            ) : (
              <>
                <p className="font-bold">Sign in to enroll</p>
                <p className="text-sm text-muted-foreground">Your progress is saved to your account, so you can resume anywhere.</p>
                <Link
                  href={`/login?callbackUrl=${encodeURIComponent(`/courses/${course.slug}`)}`}
                  className={buttonVariants({ size: "xl", className: "w-full" })}
                >
                  Sign in
                </Link>
                <Link href="/register" className={buttonVariants({ variant: "outline", size: "lg", className: "w-full" })}>
                  Create an account
                </Link>
              </>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
