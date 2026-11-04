import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CourseCard } from "@/components/learning/course-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/auth/session";
import { levelLabel } from "@/lib/format";
import { getDefaultOrgId, getEnrolledCourseIds, listCatalog, listCategories } from "@/lib/queries/catalog";

export const metadata: Metadata = { title: "Course catalog" };

const selectClass =
  "h-11 rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; level?: string }>;
}) {
  const filters = await searchParams;
  const user = await getCurrentUser();
  const orgId = user?.orgId ?? (await getDefaultOrgId());

  const [courses, categories, enrolled] = orgId
    ? await Promise.all([
        listCatalog(orgId, filters),
        listCategories(orgId),
        user ? getEnrolledCourseIds(user.id) : Promise.resolve(new Set<string>()),
      ])
    : [[], [], new Set<string>()];

  const hasFilters = Boolean(filters.q || filters.category || filters.level);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8 max-w-2xl space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Course catalog</h1>
        <p className="text-muted-foreground">
          Every course gives you a clear path — lessons, a quiz per module, and a next step at every point.
        </p>
      </header>

      <form method="GET" role="search" className="mb-8 grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <label htmlFor="q" className="sr-only">
            Search courses
          </label>
          <Search className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground" aria-hidden />
          <Input id="q" name="q" defaultValue={filters.q} placeholder="Search courses" className="h-11 pl-9" />
        </div>
        <div>
          <label htmlFor="category" className="sr-only">
            Category
          </label>
          <select id="category" name="category" defaultValue={filters.category ?? ""} className={selectClass}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="level" className="sr-only">
            Level
          </label>
          <select id="level" name="level" defaultValue={filters.level ?? ""} className={selectClass}>
            <option value="">All levels</option>
            {Object.entries(levelLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="lg" className="h-11 flex-1">
            Filter
          </Button>
          {hasFilters && (
            <Link href="/courses" className={buttonVariants({ variant: "ghost", size: "lg", className: "h-11" })}>
              Clear
            </Link>
          )}
        </div>
      </form>

      {courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-white/70 p-12 text-center">
          <p className="text-lg font-semibold">{hasFilters ? "No courses match those filters." : "No courses published yet."}</p>
          <p className="mt-1 text-muted-foreground">
            {hasFilters ? "Try a different search or clear the filters." : "Check back soon."}
          </p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
            {courses.length} {courses.length === 1 ? "course" : "courses"}
          </p>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <li key={course.id} className="flex">
                <div className="flex w-full">
                  <CourseCard course={course} enrolled={enrolled.has(course.id)} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
