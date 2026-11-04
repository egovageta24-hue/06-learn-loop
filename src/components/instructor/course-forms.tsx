"use client";

import { useActionState, useState, useTransition } from "react";
import { createCourseAction, setCourseStatusAction, updateCourseAction, type EditorFormState } from "@/actions/course-editor";
import { SaveStatus, SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { COVER_THEME_KEYS, levelLabel } from "@/lib/format";

const LEVEL_OPTIONS = Object.entries(levelLabel).map(([value, label]) => ({ value, label }));
const THEME_OPTIONS = COVER_THEME_KEYS.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }));

export interface CourseFormValues {
  title: string;
  summary: string;
  description: string;
  category: string;
  level: string;
  coverTheme: string;
}

export function CourseDetailsForm({ courseId, values }: { courseId?: string; values?: CourseFormValues }) {
  const action = courseId ? updateCourseAction.bind(null, courseId) : createCourseAction;
  const [state, formAction, pending] = useActionState<EditorFormState, FormData>(action, undefined);
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      <TextField name="title" label="Course title" defaultValue={values?.title} error={fe.title} required maxLength={100} />
      <TextField
        name="summary"
        label="One-line summary"
        defaultValue={values?.summary}
        error={fe.summary}
        hint="Shown on the catalog card."
        maxLength={200}
      />
      <TextAreaField name="description" label="About this course" defaultValue={values?.description} error={fe.description} rows={4} maxLength={4000} />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField name="category" label="Category" defaultValue={values?.category ?? "General"} error={fe.category} required maxLength={40} />
        <SelectField name="level" label="Level" options={LEVEL_OPTIONS} defaultValue={values?.level ?? "beginner"} error={fe.level} />
        <SelectField name="coverTheme" label="Cover style" options={THEME_OPTIONS} defaultValue={values?.coverTheme ?? "violet"} error={fe.coverTheme} />
      </div>
      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : courseId ? "Save details" : "Create course"}
        </Button>
        <SaveStatus state={state} />
      </div>
    </form>
  );
}

export function PublishControls({ courseId, status }: { courseId: string; status: "draft" | "published" | "archived" }) {
  const [problems, setProblems] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  function change(next: "draft" | "published" | "archived") {
    startTransition(async () => {
      const res = await setCourseStatusAction(courseId, next);
      setProblems(res.ok ? [] : res.errors);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status !== "published" && (
          <Button type="button" size="lg" onClick={() => change("published")} disabled={pending}>
            {status === "archived" ? "Restore & publish" : "Publish course"}
          </Button>
        )}
        {status === "published" && (
          <Button type="button" size="lg" variant="outline" onClick={() => change("draft")} disabled={pending}>
            Unpublish (back to draft)
          </Button>
        )}
        {status !== "archived" && (
          <Button type="button" size="lg" variant="ghost" onClick={() => change("archived")} disabled={pending}>
            Archive
          </Button>
        )}
      </div>
      {problems.length > 0 && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="font-semibold text-destructive">This course isn&apos;t ready to publish yet:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
