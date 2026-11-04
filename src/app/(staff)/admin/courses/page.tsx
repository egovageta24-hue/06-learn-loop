import { formatDistanceToNow } from "date-fns";
import type { Metadata } from "next";
import Link from "next/link";
import { CourseRowControls } from "@/components/admin/admin-controls";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import { listInstructors, listOrgCourses } from "@/lib/queries/admin";

export const metadata: Metadata = { title: "Courses" };

const STATUS_STYLE = {
  published: "bg-emerald-100 text-emerald-800",
  draft: "bg-slate-100 text-slate-700",
  archived: "bg-amber-100 text-amber-900",
} as const;

export default async function AdminCoursesPage() {
  const admin = await requireRole("admin");
  const [courses, instructors] = await Promise.all([listOrgCourses(admin.orgId), listInstructors(admin.orgId)]);

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight">Courses</h1>
        <p className="text-muted-foreground">
          Publish or archive courses and reassign who owns them. Publishing checks the course is complete first.
        </p>
      </header>

      <div className="overflow-x-auto rounded-2xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Course</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Learners</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Instructor &amp; visibility</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/instructor/courses/${c.id}/edit`} className="font-semibold hover:underline">
                    {c.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge className={STATUS_STYLE[c.status]}>{c.status}</Badge>
                </TableCell>
                <TableCell className="tabular-nums">{c.enrolled}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDistanceToNow(c.updatedAt, { addSuffix: true })}</TableCell>
                <TableCell>
                  <CourseRowControls courseId={c.id} status={c.status} instructorId={c.instructorId} instructors={instructors} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
