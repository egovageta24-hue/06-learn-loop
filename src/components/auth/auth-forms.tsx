"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { loginAction, registerAction, type AuthFormState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface DemoAccount {
  email: string;
  name: string;
  role: string;
  note: string;
}

function Field({
  id,
  label,
  error,
  ...props
}: { id: string; label: string; error?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-11"
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}

export function LoginForm({
  callbackUrl,
  demoAccounts,
  demoPassword,
}: {
  callbackUrl?: string;
  demoAccounts: DemoAccount[];
  demoPassword: string;
}) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(loginAction, undefined);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4">
        {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
        <FormError message={state?.error} />
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={state?.fieldErrors?.email}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={state?.fieldErrors?.password}
        />
        <Button type="submit" size="xl" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New to LearnLoop?{" "}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          Create a learner account
        </Link>
      </p>

      {demoAccounts.length > 0 && (
        <section aria-labelledby="demo-heading" className="rounded-xl border border-dashed bg-secondary/40 p-4">
          <h2 id="demo-heading" className="text-sm font-semibold">
            Try a demo account
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">Fills the form — then press Sign in.</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {demoAccounts.map((a) => (
              <li key={a.email}>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword(demoPassword);
                  }}
                  className="w-full rounded-lg border bg-white px-3 py-2 text-left transition-colors hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="block text-sm font-semibold">{a.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {a.role} · {a.note}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(registerAction, undefined);

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4">
        <FormError message={state?.error} />
        <Field id="name" label="Full name" autoComplete="name" required error={state?.fieldErrors?.name} />
        <Field id="email" label="Work email" type="email" autoComplete="email" required error={state?.fieldErrors?.email} />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          error={state?.fieldErrors?.password}
        />
        <Button type="submit" size="xl" className="w-full" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
