import { redirect } from "next/navigation";
import { getLearningContext } from "@/lib/queries/context";

/** /learn/[course] has no UI of its own: it sends the learner to their next action. */
export default async function LearnIndex({ params }: { params: Promise<{ course: string }> }) {
  const { course } = await params;
  const { next } = await getLearningContext(course);
  redirect(next.href);
}
