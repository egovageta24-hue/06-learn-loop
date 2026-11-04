import type { Metadata } from "next";
import { LoginForm, type DemoAccount } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

const DEMO_PASSWORD = "learnloop123";

const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: "ava@learnloop.test", name: "Ava Chen", role: "Learner", note: "mid-course, ready to resume" },
  { email: "ben@learnloop.test", name: "Ben Okafor", role: "Learner", note: "failed a quiz — review required" },
  { email: "chloe@learnloop.test", name: "Chloe Martin", role: "Learner", note: "reviewed — ready to retake" },
  { email: "dev@learnloop.test", name: "Dev Patel", role: "Learner", note: "3 failed attempts — escalated" },
  { email: "grace@learnloop.test", name: "Grace Kim", role: "Learner", note: "quiz in progress" },
  { email: "maya@learnloop.test", name: "Maya Brooks", role: "Instructor", note: "owns 3 courses" },
  { email: "admin@learnloop.test", name: "Sam Rivera", role: "Admin", note: "manages users & courses" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; reason?: string }>;
}) {
  const { callbackUrl, reason } = await searchParams;
  const showDemo = process.env.SHOW_DEMO_ACCOUNTS !== "false";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground">Sign in to pick up exactly where you left off.</p>
      </div>
      {reason === "signed-out" && (
        <p role="status" className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
          You were signed out. If your account was suspended, contact your organization admin.
        </p>
      )}
      <LoginForm
        callbackUrl={callbackUrl}
        demoAccounts={showDemo ? DEMO_ACCOUNTS : []}
        demoPassword={DEMO_PASSWORD}
      />
    </div>
  );
}
