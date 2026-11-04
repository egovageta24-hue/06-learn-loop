"use client";

import { ArrowRight, CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { toast } from "sonner";
import { completeLessonAction, recordLessonOpened } from "@/actions/learning";
import { Button } from "@/components/ui/button";

/**
 * Records that the lesson was opened (moves the resume pointer) and renders the
 * single "finish this lesson" button. The server tells us where to go next.
 */
export function LessonActions({
  lessonId,
  isReviewItem,
}: {
  lessonId: string;
  /** True when this lesson is an unreviewed item of an open remediation. */
  isReviewItem: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void recordLessonOpened(lessonId);
  }, [lessonId]);

  function complete() {
    startTransition(async () => {
      const result = await completeLessonAction(lessonId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(result.nextHref);
    });
  }

  return (
    <Button type="button" size="xl" onClick={complete} disabled={pending} className="w-full sm:w-auto">
      <CircleCheck data-icon="inline-start" />
      {pending ? "Saving…" : isReviewItem ? "Mark as reviewed & continue" : "Complete & continue"}
      {!pending && <ArrowRight data-icon="inline-end" />}
    </Button>
  );
}
