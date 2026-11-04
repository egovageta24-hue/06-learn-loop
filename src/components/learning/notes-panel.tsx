"use client";

import { Bookmark, BookmarkCheck, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addNoteAction, deleteNoteAction, toggleBookmarkAction } from "@/actions/learning";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface PanelNote {
  id: string;
  body: string;
  createdAt: string;
}

export function NotesPanel({
  lessonId,
  notes,
  bookmarked,
}: {
  lessonId: string;
  notes: PanelNote[];
  bookmarked: boolean;
}) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await addNoteAction({ lessonId, body });
      if (res.ok) setBody("");
      else toast.error(res.error);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteNoteAction(id);
      if (!res.ok) toast.error(res.error);
    });
  }

  function toggleBookmark() {
    startTransition(async () => {
      const res = await toggleBookmarkAction(lessonId);
      if (!res.ok) toast.error(res.error);
      else toast.success(res.bookmarked ? "Lesson bookmarked" : "Bookmark removed");
    });
  }

  return (
    <section aria-labelledby="notes-heading" className="space-y-4 rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="notes-heading" className="font-bold">
          My notes
        </h2>
        <Button
          type="button"
          variant={bookmarked ? "secondary" : "outline"}
          size="sm"
          onClick={toggleBookmark}
          disabled={pending}
          aria-pressed={bookmarked}
        >
          {bookmarked ? <BookmarkCheck className="text-orange-500" data-icon="inline-start" /> : <Bookmark data-icon="inline-start" />}
          {bookmarked ? "Bookmarked" : "Bookmark"}
        </Button>
      </div>

      <form onSubmit={save} className="space-y-2">
        <Label htmlFor="note-body" className="sr-only">
          New note
        </Label>
        <Textarea
          id="note-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Jot down something worth remembering…"
          rows={3}
          maxLength={2000}
        />
        <Button type="submit" size="sm" disabled={pending || body.trim().length === 0}>
          Save note
        </Button>
      </form>

      {notes.length > 0 && (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="group flex items-start gap-2 rounded-xl bg-secondary/50 p-3 text-sm">
              <p className="flex-1 whitespace-pre-wrap">{n.body}</p>
              <button
                type="button"
                onClick={() => remove(n.id)}
                disabled={pending}
                aria-label="Delete note"
                className="rounded-md p-1 text-muted-foreground hover:bg-white hover:text-destructive focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
