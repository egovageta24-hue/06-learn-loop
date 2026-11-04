"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { homeFor } from "@/lib/auth/roles";
import { getDefaultOrgId } from "@/lib/queries/catalog";

export type AuthFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

/** Only same-site relative paths — never an open redirect. */
function safeCallback(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : null;
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  password: z.string().min(1, "Enter your password."),
});

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }

  try {
    await signIn("credentials", { ...parsed.data, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) return { error: "That email and password don't match an active account." };
    throw err;
  }

  const [user] = await db.select({ role: users.role }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
  redirect(safeCallback(formData.get("callbackUrl")) ?? homeFor(user?.role ?? "learner"));
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
});

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }

  const orgId = await getDefaultOrgId();
  if (!orgId) return { error: "Registration is not available yet." };

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (existing) return { fieldErrors: { email: "An account with this email already exists." } };

  await db.insert(users).values({
    orgId,
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash: await bcrypt.hash(parsed.data.password, 10),
    role: "learner",
  });

  await signIn("credentials", { email: parsed.data.email, password: parsed.data.password, redirect: false });
  redirect("/dashboard");
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
