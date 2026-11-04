"use client";

import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EditorFormState } from "@/actions/course-editor";
import { cn } from "@/lib/utils";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function Err({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={`${id}-error`} className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function TextField({
  name,
  label,
  error,
  hint,
  className,
  ...props
}: { name: string; label: string; error?: string; hint?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} aria-invalid={error ? true : undefined} aria-describedby={error ? `${name}-error` : undefined} {...props} />
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      <Err id={name} message={error} />
    </div>
  );
}

export function TextAreaField({
  name,
  label,
  error,
  hint,
  className,
  ...props
}: { name: string; label: string; error?: string; hint?: string } & React.ComponentProps<typeof Textarea>) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} aria-invalid={error ? true : undefined} aria-describedby={error ? `${name}-error` : undefined} {...props} />
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      <Err id={name} message={error} />
    </div>
  );
}

export function SelectField({
  name,
  label,
  error,
  options,
  defaultValue,
  className,
}: {
  name: string;
  label: string;
  error?: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} defaultValue={defaultValue} className={selectClass} aria-invalid={error ? true : undefined}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Err id={name} message={error} />
    </div>
  );
}

export const nativeSelectClass = selectClass;

/** "Saved" confirmation that announces itself to screen readers. */
export function SaveStatus({ state }: { state: EditorFormState }) {
  return (
    <span role="status" aria-live="polite" className="text-sm">
      {state?.error && <span className="text-destructive">{state.error}</span>}
      {state?.ok && (
        <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
          <Check className="size-4" aria-hidden /> Saved
        </span>
      )}
    </span>
  );
}
