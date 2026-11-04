import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Create your account" };

export default function RegisterPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Start learning</h1>
        <p className="text-muted-foreground">Create a learner account — you will always see your next step.</p>
      </div>
      <RegisterForm />
    </div>
  );
}
