import { Bookmark, LifeBuoy, NotebookPen, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CourseCover } from "@/components/brand/course-cover";
import { ProgressRing } from "@/components/brand/progress";
import { EnrolledCourseCard } from "@/components/learning/enrolled-course-card";
import { NextActionLink } from "@/components/learning/next-action-link";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getLearnerCourses, getNotes } from "@/lib/queries/learner";
import { formatDistanceToNow } from "date-fns";

export const metadata: Metadata = { title: "My learning" };

export default async function DashboardPage() {
  const user = await requireUser();
  const [courses, notes] = await Promise.all([getLearnerCourses(user.id), getNotes(user.id, 5)]);

  const active = courses.filter((c) => !c.progress.isComplete);
  const completed = courses.filter((c) => c.progress.isComplete);
  const featured = active[0];

  // Things that need attention, surfaced above everything else.
  const reviews = active.filter((c) => c.next.type === "review_remediation");
  const escalated = active.filter((c) => c.next.type === "retake_quiz" && c.next.escalated);

  return (
    <main className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight">Hi {user.name.split(" ")[0]} 👋</h1>
        <p className="text-muted-foreground">
          {featured ? "Here's exactly where to pick up." : courses.length ? "You've finished everything — nice work." : "Let's find your first course."}
        </p>
      </header>

      {(reviews.length > 0 || escalated.length > 0) && (
        <section aria-label="Needs attention" className="space-y-3">
          {reviews.map((c) => (
            <div key={c.enrollmentId} role="status" className="flex flex-wrap items-center gap-4 rounded-2xl border border-orange-300 bg-orange-50 p-4">
              <TriangleAlert className="size-6 shrink-0 text-orange-600" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-orange-950">{c.next.label}</p>
                <p className="text-sm text-orange-900/80">in {c.outline.title} — a quick review unlocks your retake.</p>
              </div>
              <Link href={c.next.href} className={buttonVariants({ size: "lg" })}>
                Start review
              </Link>
            </div>
          ))}
          {escalated.map((c) => (
            <div key={c.enrollmentId} role="status" className="flex flex-wrap items-center gap-4 rounded-2xl border bg-accent p-4">
              <LifeBuoy className="size-6 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Stuck on a quiz in {c.outline.title}?</p>
                <p className="text-sm text-muted-foreground">
                  Your instructor can see you&apos;ve had a few tries and can help. You can retry whenever you&apos;re ready.
                </p>
              </div>
              <Link href={c.next.href} className={buttonVariants({ size: "lg", variant: "outline" })}>
                Try again
              </Link>
            </div>
          ))}
        </section>
      )}

      {featured && (
        <section aria-labelledby="continue" className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="grid md:grid-cols-[18rem_1fr]">
            <div className="hidden min-h-48 md:block">
              <CourseCover theme={featured.coverTheme} seed={featured.outline.slug} />
            </div>
            <div className="space-y-5 p-6 sm:p-8">
              <p id="continue" className="text-xs font-bold tracking-wider text-orange-600 uppercase">
                Your next step
              </p>
              <div className="flex items-center gap-5">
                <ProgressRing value={featured.progress.percent} size={84} stroke={9} label={`${featured.outline.title} progress`} />
                <div className="min-w-0">
                  <h2 className="text-2xl leading-tight font-bold tracking-tight">{featured.outline.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {featured.progress.doneUnits} of {featured.progress.totalUnits} steps complete · last active{" "}
                    {formatDistanceToNow(featured.lastActivityAt, { addSuffix: true })}
                  </p>
                </div>
              </div>
              <NextActionLink action={featured.next} size="xl" className="w-full sm:w-auto" />
            </div>
          </div>
        </section>
      )}

      {courses.length === 0 && (
        <section className="rounded-3xl border border-dashed bg-white/70 p-12 text-center">
          <h2 className="text-xl font-bold">You haven&apos;t enrolled in anything yet</h2>
          <p className="mx-auto mt-1 max-w-md text-muted-foreground">
            Browse the catalog, enroll in a course, and your next step will appear right here.
          </p>
          <Link href="/courses" className={buttonVariants({ size: "xl", className: "mt-5" })}>
            Browse courses
          </Link>
        </section>
      )}

      {active.length > 0 && (
        <section aria-labelledby="in-progress" className="space-y-4">
          <h2 id="in-progress" className="text-xl font-bold">
            In progress
          </h2>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((c) => (
              <li key={c.enrollmentId} className="flex">
                <div className="flex w-full">
                  <EnrolledCourseCard course={c} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {completed.length > 0 && (
        <section aria-labelledby="completed" className="space-y-4">
          <h2 id="completed" className="text-xl font-bold">
            Completed
          </h2>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {completed.map((c) => (
              <li key={c.enrollmentId} className="flex">
                <div className="flex w-full">
                  <EnrolledCourseCard course={c} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {notes.length > 0 && (
        <section aria-labelledby="notes" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 id="notes" className="text-xl font-bold">
              Recent notes &amp; bookmarks
            </h2>
            <Link href="/progress" className="text-sm font-semibold text-primary hover:underline">
              See all
            </Link>
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {notes.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/learn/${n.courseSlug}/lessons/${n.lessonId}`}
                  className="flex gap-3 rounded-2xl border bg-white p-4 transition-colors hover:border-primary"
                >
                  {n.kind === "bookmark" ? (
                    <Bookmark className="mt-0.5 size-5 shrink-0 text-orange-500" aria-label="Bookmark" />
                  ) : (
                    <NotebookPen className="mt-0.5 size-5 shrink-0 text-primary" aria-label="Note" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{n.lessonTitle}</p>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{n.body ?? "Bookmarked lesson"}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{n.courseTitle}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
