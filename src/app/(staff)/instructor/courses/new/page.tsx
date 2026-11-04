import type { Metadata } from "next";
import Link from "next/link";
import { CourseDetailsForm } from "@/components/instructor/course-forms";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New course" };

export default async function NewCoursePage() {
  await requireRole("instructor", "admin");
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">
          <Link href="/instructor" className="font-medium hover:underline">
            Instructor dashboard
          </Link>{" "}
          / New course
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight">Create a course</h1>
        <p className="text-muted-foreground">Start with the basics — you&apos;ll add modules, lessons and quizzes next. It stays a draft until you publish.</p>
      </header>
      <div className="rounded-2xl border bg-white p-6">
        <CourseDetailsForm />
      </div>
    </main>
  );
}
