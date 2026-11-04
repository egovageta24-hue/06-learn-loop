"use client";

import { Send } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveAnswerAction, submitAttemptAction } from "@/actions/learning";
import { ProgressBar } from "@/components/brand/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RunnerQuestion } from "@/lib/queries/quiz";

export function QuizRunner({
  attemptId,
  questions,
  saved,
}: {
  attemptId: string;
  questions: RunnerQuestion[];
  saved: Record<string, string[]>;
}) {
  const [answers, setAnswers] = useState<Record<string, string[]>>(saved);
  const [confirming, setConfirming] = useState(false);
  const [submitting, startSubmit] = useTransition();
  // Saves run strictly one after another, and submit waits for the tail of the chain.
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  const answeredCount = questions.filter((q) => (answers[q.id]?.length ?? 0) > 0).length;
  const unanswered = questions.length - answeredCount;

  function choose(q: RunnerQuestion, optionId: string) {
    const current = answers[q.id] ?? [];
    const next =
      q.type === "multiple"
        ? current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId]
        : [optionId];

    setAnswers((a) => ({ ...a, [q.id]: next }));
    setConfirming(false);
    chain.current = chain.current.then(async () => {
      const res = await saveAnswerAction({ attemptId, questionId: q.id, optionIds: next });
      if (!res.ok) toast.error(res.error);
    });
  }

  function submit() {
    if (unanswered > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    startSubmit(async () => {
      await chain.current; // make sure every answer is stored before scoring
      await submitAttemptAction(attemptId);
    });
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-[4.5rem] z-10 rounded-2xl border bg-white/95 p-4 shadow-sm backdrop-blur">
        <ProgressBar value={(answeredCount / questions.length) * 100} label="Questions answered" />
        <p className="mt-1.5 text-sm text-muted-foreground" aria-live="polite">
          {answeredCount} of {questions.length} answered · saved automatically
        </p>
      </div>

      <ol className="space-y-5">
        {questions.map((q, qi) => (
          <li key={q.id}>
            <fieldset className="rounded-2xl border bg-white p-5 sm:p-6">
              <legend className="sr-only">Question {qi + 1}</legend>
              <p className="mb-1 text-xs font-bold tracking-wider text-primary uppercase">Question {qi + 1}</p>
              <p className="text-lg font-semibold">{q.prompt}</p>
              {q.type === "multiple" && <p className="mt-1 text-sm text-muted-foreground">Select all that apply.</p>}
              <div className="mt-4 space-y-2">
                {q.options.map((o) => {
                  const checked = answers[q.id]?.includes(o.id) ?? false;
                  return (
                    <label
                      key={o.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                        checked ? "border-primary bg-secondary" : "hover:bg-muted/60",
                      )}
                    >
                      <input
                        type={q.type === "multiple" ? "checkbox" : "radio"}
                        name={`q-${q.id}`}
                        checked={checked}
                        onChange={() => choose(q, o.id)}
                        className="size-4 accent-[var(--primary)]"
                      />
                      <span>{o.text}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>

      <div className="space-y-3 rounded-2xl border bg-white p-5">
        {confirming && (
          <p role="alert" className="rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-900">
            You have {unanswered} unanswered {unanswered === 1 ? "question" : "questions"}. Unanswered questions count as
            incorrect — submit anyway?
          </p>
        )}
        <Button type="button" size="xl" onClick={submit} disabled={submitting} className="w-full sm:w-auto">
          <Send data-icon="inline-start" />
          {submitting ? "Scoring…" : confirming ? "Yes, submit my answers" : "Submit quiz"}
        </Button>
      </div>
    </div>
  );
}
