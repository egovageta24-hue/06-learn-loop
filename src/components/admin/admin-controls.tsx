"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createUserAction,
  reassignCourseAction,
  setUserRoleAction,
  setUserStatusAction,
  type CreateUserState,
} from "@/actions/admin";
import { setCourseStatusAction } from "@/actions/course-editor";
import { nativeSelectClass } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLES, roleLabel, type Role } from "@/lib/auth/roles";

export function CreateUserForm() {
  const [state, action, pending] = useActionState<CreateUserState, FormData>(createUserAction, undefined);
  const fe = state?.fieldErrors ?? {};
  const field = (name: string, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`new-${name}`}>{label}</Label>
      <Input id={`new-${name}`} name={name} aria-invalid={fe[name] ? true : undefined} required {...props} />
      {fe[name] && <p className="text-sm text-destructive">{fe[name]}</p>}
    </div>
  );

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", "Full name", { autoComplete: "off" })}
        {field("email", "Email", { type: "email", autoComplete: "off" })}
        <div className="space-y-1.5">
          <Label htmlFor="new-role">Role</Label>
          <select id="new-role" name="role" defaultValue="learner" className={nativeSelectClass}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel[r]}
              </option>
            ))}
          </select>
        </div>
        {field("password", "Temporary password", { type: "text", minLength: 8, autoComplete: "off" })}
      </div>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create user"}
        </Button>
        <span role="status" aria-live="polite" className="text-sm">
          {state?.error && <span className="text-destructive">{state.error}</span>}
          {state?.created && <span className="font-medium text-emerald-700">Created {state.created}. Share the temporary password securely.</span>}
        </span>
      </div>
    </form>
  );
}

export function UserRowControls({
  userId,
  name,
  role,
  status,
  isSelf,
}: {
  userId: string;
  name: string;
  role: Role;
  status: "active" | "suspended";
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    startTransition(async () => {
      const res = await fn();
      setError(res.ok ? null : res.error);
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`role-${userId}`}>
        Role for {name}
      </label>
      <select
        id={`role-${userId}`}
        value={role}
        disabled={isSelf || pending}
        onChange={(e) => run(() => setUserRoleAction(userId, e.target.value))}
        className={`${nativeSelectClass} w-44`}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {roleLabel[r]}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        variant={status === "active" ? "outline" : "secondary"}
        disabled={isSelf || pending}
        onClick={() => run(() => setUserStatusAction(userId, status === "active" ? "suspended" : "active"))}
      >
        {status === "active" ? "Suspend" : "Reactivate"}
      </Button>
      {error && (
        <p role="alert" className="w-full text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function CourseRowControls({
  courseId,
  status,
  instructorId,
  instructors,
}: {
  courseId: string;
  status: "draft" | "published" | "archived";
  instructorId: string;
  instructors: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [problems, setProblems] = useState<string[]>([]);

  function changeStatus(next: "draft" | "published" | "archived") {
    startTransition(async () => {
      const res = await setCourseStatusAction(courseId, next);
      setProblems(res.ok ? [] : res.errors);
    });
  }

  function reassign(id: string) {
    startTransition(async () => {
      const res = await reassignCourseAction(courseId, id);
      if (!res.ok) toast.error(res.error);
      else toast.success("Instructor updated");
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`instr-${courseId}`}>
          Instructor
        </label>
        <select
          id={`instr-${courseId}`}
          value={instructorId}
          disabled={pending}
          onChange={(e) => reassign(e.target.value)}
          className={`${nativeSelectClass} w-44`}
        >
          {instructors.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        {status !== "published" && (
          <Button type="button" size="sm" disabled={pending} onClick={() => changeStatus("published")}>
            Publish
          </Button>
        )}
        {status === "published" && (
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => changeStatus("draft")}>
            Unpublish
          </Button>
        )}
        {status !== "archived" && (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => changeStatus("archived")}>
            Archive
          </Button>
        )}
      </div>
      {problems.length > 0 && (
        <ul role="alert" className="list-disc space-y-0.5 pl-5 text-xs text-destructive">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
