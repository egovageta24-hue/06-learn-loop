"use client";

import { useActionState, useState } from "react";
import { updateLessonAction, type EditorFormState } from "@/actions/course-editor";
import { SaveStatus, TextField } from "@/components/forms/fields";
import { Markdown } from "@/components/learning/markdown";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface LessonValues {
  title: string;
  type: "reading" | "video";
  durationMin: number;
  videoUrl: string | null;
  content: string;
}

export function LessonForm({ lessonId, values }: { lessonId: string; values: LessonValues }) {
  const [state, action, pending] = useActionState<EditorFormState, FormData>(updateLessonAction.bind(null, lessonId), undefined);
  const [type, setType] = useState(values.type);
  const [content, setContent] = useState(values.content);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5">
      <TextField name="title" label="Lesson title" defaultValue={values.title} error={fe.title} required maxLength={120} />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="type">Type</Label>
          <select
            id="type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as "reading" | "video")}
            className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="reading">Reading</option>
            <option value="video">Video</option>
          </select>
        </div>
        <TextField name="durationMin" label="Minutes" type="number" min={1} max={240} defaultValue={values.durationMin} error={fe.durationMin} required />
        {type === "video" ? (
          <TextField
            name="videoUrl"
            label="Video link"
            type="url"
            placeholder="https://youtu.be/…"
            defaultValue={values.videoUrl ?? ""}
            error={fe.videoUrl}
            hint="YouTube links are embedded; other links play as a video file."
          />
        ) : (
          // Keep the field present (empty) so switching back to reading clears a stale link.
          <input type="hidden" name="videoUrl" value="" />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="content">Lesson content (Markdown)</Label>
          <div role="tablist" aria-label="Editor mode" className="inline-flex rounded-lg bg-secondary p-0.5 text-sm">
            {(["write", "preview"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn("rounded-md px-3 py-1 font-medium capitalize", tab === t ? "bg-white shadow-xs" : "text-muted-foreground")}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* The textarea stays mounted so its value is always submitted, even while previewing. */}
        <div className={cn("space-y-1.5", tab === "write" ? "" : "hidden")}>
          <Textarea
            id="content"
            name="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            aria-invalid={fe.content ? true : undefined}
            aria-describedby={fe.content ? "content-error" : undefined}
          />
          {fe.content ? (
            <p id="content-error" className="text-sm text-destructive">
              {fe.content}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Use ## for headings, - for bullets, **bold** and *italic*.</p>
          )}
        </div>
        {tab === "preview" && (
          <div className="min-h-64 rounded-xl border bg-white p-5">
            <Markdown>{content || "_Nothing to preview yet._"}</Markdown>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save lesson"}
        </Button>
        <SaveStatus state={state} />
      </div>
    </form>
  );
}
