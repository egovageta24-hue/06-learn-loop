import "server-only";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getNextAction } from "@/lib/learning/next-action";
import { computeProgress } from "@/lib/learning/progress";
import { getEnrollment, loadEnrollmentState, loadOutline } from "./learning";

/**
 * Everything a learning page needs, with access rules applied once:
 *  - the course must exist in the user's organisation
 *  - drafts are visible only to their instructor and admins
 *  - the user must be enrolled (otherwise we send them to the course page)
 */
export async function getLearningContext(courseSlug: string) {
  const user = await requireUser();
  const outline = await loadOutline({ slug: courseSlug });
  if (!outline || outline.orgId !== user.orgId) notFound();
  if (outline.status === "draft" && user.role !== "admin" && outline.instructorId !== user.id) notFound();

  const enrollment = await getEnrollment(user.id, outline.id);
  if (!enrollment) redirect(`/courses/${outline.slug}`);

  const state = await loadEnrollmentState(enrollment.id);
  const progress = computeProgress(outline, state);
  const next = getNextAction(outline, state);
  return { user, outline, enrollment, state, progress, next };
}
