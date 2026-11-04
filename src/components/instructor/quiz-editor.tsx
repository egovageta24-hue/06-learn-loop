"use client";

import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteQuestionAction,
  moveQuestionAction,
  saveQuestionAction,
  updateQuizAction,
  type EditorFormState,
} from "@/actions/course-editor";
import { nativeSelectClass, SaveStatus, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function QuizSettingsForm({
  quizId,
  values,
}: {
  quizId: string;
  values: { title: string; passScore: number; escalateAfter: number };
}) {
  const [state, action, pending] = useActionState<EditorFormState, FormData>(updateQuizAction.bind(null, quizId), undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <TextField name="title" label="Quiz title" defaultValue={values.title} error={fe.title} required maxLength={120} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="passScore"
          label="Pass mark (%)"
          type="number"
          min={1}
          max={100}
          defaultValue={values.passScore}
          error={fe.passScore}
          required
        />
        <TextField
          name="escalateAfter"
          label="Flag for help after N failed attempts"
          type="number"
          min={1}
          max={10}
          defaultValue={values.escalateAfter}
          error={fe.escalateAfter}
          hint="After this many fails the review gate lifts and you see the learner under “Needs help”."
          required
        />
      </div>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save quiz settings"}
        </Button>
        <SaveStatus state={state} />
      </div>
    </form>
  );
}

type QType = "single" | "multiple" | "true_false";
interface Opt {
  id?: string;
  text: string;
  isCorrect: boolean;
}
export interface QuestionData {
  id?: string;
  prompt: string;
  type: QType;
  explanation: string;
  lessonId: string | null;
  options: Opt[];
}

const TYPE_LABEL: Record<QType, string> = {
  single: "Single choice",
  multiple: "Multiple choice (select all)",
  true_false: "True / false",
};

export function blankQuestion(): QuestionData {
  return {
    prompt: "",
    type: "single",
    explanation: "",
    lessonId: null,
    options: [
      { text: "", isCorrect: true },
      { text: "", isCorrect: false },
    ],
  };
}

export function QuestionEditor({
  quizId,
  question,
  lessons,
  index,
  count,
  onSaved,
  onCancel,
}: {
  quizId: string;
  question: QuestionData;
  lessons: { id: string; title: string }[];
  /** Position in the list; undefined for a brand-new question. */
  index?: number;
  count?: number;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [q, setQ] = useState<QuestionData>(question);
  const [pending, startTransition] = useTransition();
  const isNew = !question.id;

  function setType(type: QType) {
    setQ((cur) => {
      if (type === "true_false") {
        const correctIsFirst = cur.options.findIndex((o) => o.isCorrect) <= 0;
        return {
          ...cur,
          type,
          options: [
            { id: cur.options[0]?.id, text: "True", isCorrect: correctIsFirst },
            { id: cur.options[1]?.id, text: "False", isCorrect: !correctIsFirst },
          ],
        };
      }
      let options = cur.options;
      if (cur.type === "true_false") options = options.map((o) => ({ ...o, text: "" }));
      if (type === "single") {
        const first = options.findIndex((o) => o.isCorrect);
        options = options.map((o, i) => ({ ...o, isCorrect: i === (first < 0 ? 0 : first) }));
      }
      return { ...cur, type, options };
    });
  }

  function toggleCorrect(i: number) {
    setQ((cur) => ({
      ...cur,
      options: cur.options.map((o, j) =>
        cur.type === "multiple" ? (j === i ? { ...o, isCorrect: !o.isCorrect } : o) : { ...o, isCorrect: j === i },
      ),
    }));
  }

  function save() {
    startTransition(async () => {
      const res = await saveQuestionAction({
        quizId,
        questionId: q.id,
        prompt: q.prompt,
        type: q.type,
        explanation: q.explanation,
        lessonId: q.lessonId,
        options: q.options,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Question saved");
      onSaved?.();
    });
  }

  function remove() {
    if (!q.id || !window.confirm("Delete this question?")) return;
    startTransition(() => deleteQuestionAction(q.id!));
  }

  const idBase = `q-${q.id ?? "new"}`;
  return (
    <div className="space-y-4 rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-muted-foreground">{isNew ? "New question" : `Question ${(index ?? 0) + 1}`}</p>
        {!isNew && (
          <div className="flex items-center">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Move question up"
              disabled={pending || index === 0}
              onClick={() => startTransition(() => moveQuestionAction(q.id!, "up"))}
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Move question down"
              disabled={pending || index === (count ?? 1) - 1}
              onClick={() => startTransition(() => moveQuestionAction(q.id!, "down"))}
            >
              <ArrowDown />
            </Button>
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Delete question" disabled={pending} onClick={remove}>
              <Trash2 className="text-destructive" />
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idBase}-prompt`}>Question</Label>
        <Textarea id={`${idBase}-prompt`} value={q.prompt} onChange={(e) => setQ({ ...q, prompt: e.target.value })} rows={2} maxLength={500} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idBase}-type`}>Type</Label>
          <select id={`${idBase}-type`} value={q.type} onChange={(e) => setType(e.target.value as QType)} className={nativeSelectClass}>
            {Object.entries(TYPE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idBase}-lesson`}>Teaches this (for targeted review)</Label>
          <select
            id={`${idBase}-lesson`}
            value={q.lessonId ?? ""}
            onChange={(e) => setQ({ ...q, lessonId: e.target.value || null })}
            className={nativeSelectClass}
          >
            <option value="">— No linked lesson —</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          Options <span className="font-normal text-muted-foreground">— mark {q.type === "multiple" ? "every correct answer" : "the correct answer"}</span>
        </legend>
        {q.options.map((o, i) => (
          <div key={o.id ?? i} className="flex items-center gap-2">
            <input
              type={q.type === "multiple" ? "checkbox" : "radio"}
              name={`${idBase}-correct`}
              checked={o.isCorrect}
              onChange={() => toggleCorrect(i)}
              aria-label={`Option ${i + 1} is correct`}
              className="size-4 shrink-0 accent-[var(--primary)]"
            />
            <Input
              value={o.text}
              readOnly={q.type === "true_false"}
              onChange={(e) => setQ({ ...q, options: q.options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
              placeholder={`Option ${i + 1}`}
              aria-label={`Option ${i + 1} text`}
              maxLength={200}
            />
            {q.type !== "true_false" && (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Remove option ${i + 1}`}
                disabled={q.options.length <= 2}
                onClick={() => setQ({ ...q, options: q.options.filter((_, j) => j !== i) })}
              >
                <X />
              </Button>
            )}
          </div>
        ))}
        {q.type !== "true_false" && q.options.length < 8 && (
          <Button type="button" size="sm" variant="outline" onClick={() => setQ({ ...q, options: [...q.options, { text: "", isCorrect: false }] })}>
            <Plus data-icon="inline-start" /> Add option
          </Button>
        )}
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor={`${idBase}-explain`}>Explanation (shown after the quiz)</Label>
        <Textarea id={`${idBase}-explain`} value={q.explanation} onChange={(e) => setQ({ ...q, explanation: e.target.value })} rows={2} maxLength={1000} />
      </div>

      <div className="flex gap-2">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Saving…" : isNew ? "Add question" : "Save question"}
        </Button>
        {isNew && onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

/** Wraps the "add a question" affordance so the page can stay a server component. */
export function NewQuestion({ quizId, lessons }: { quizId: string; lessons: { id: string; title: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" size="lg" variant="secondary" onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" /> Add question
      </Button>
    );
  }
  return (
    <QuestionEditor quizId={quizId} question={blankQuestion()} lessons={lessons} onSaved={() => setOpen(false)} onCancel={() => setOpen(false)} />
  );
}
