import { ArrowRight, BookOpenCheck, ChartColumn, CircleCheck, Compass, RotateCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ProgressBar, ProgressRing } from "@/components/brand/progress";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: BookOpenCheck,
    title: "Learn in short lessons",
    body: "Each course is split into modules and bite-size lessons. Finish one and the next opens — no hunting around.",
  },
  {
    icon: CircleCheck,
    title: "Check what stuck",
    body: "A quiz closes every module. Your score is saved, scored on the server, and explained question by question.",
  },
  {
    icon: RotateCcw,
    title: "Fix gaps, then move on",
    body: "Miss a few? LearnLoop points you to exactly the lessons to revisit, then unlocks a retake. Never a dead end.",
  },
];

const ROLES = [
  {
    icon: Compass,
    title: "Learners",
    body: "One clear next action on every screen, resume where you stopped, and notes and bookmarks that stay with the lesson.",
  },
  {
    icon: ChartColumn,
    title: "Instructors",
    body: "See who is on track, who is stuck on which quiz, and which questions are tripping people up — from real learner data.",
  },
  {
    icon: ShieldCheck,
    title: "Organization admins",
    body: "Manage people and courses in one place with role-based access, so the right people see the right things.",
  },
];

function HeroCard() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden>
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-violet-200/70 via-sky-100/60 to-transparent blur-2xl" />
      <div className="rounded-3xl border bg-white p-6 shadow-xl shadow-violet-200/40">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Your next step</p>
        <div className="mt-3 flex items-center gap-4">
          <ProgressRing value={62} size={72} label="Course progress" />
          <div>
            <p className="font-bold leading-tight">Project Management Essentials</p>
            <p className="text-sm text-muted-foreground">Module 2 · Planning &amp; Delivery</p>
          </div>
        </div>
        <ol className="mt-5 space-y-2.5 text-sm">
          {[
            { label: "Breaking work down with a WBS", state: "done" },
            { label: "Estimating and scheduling", state: "done" },
            { label: "Tracking risks", state: "current" },
            { label: "Module quiz", state: "todo" },
          ].map((s) => (
            <li
              key={s.label}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2",
                s.state === "current" && "bg-orange-50 ring-1 ring-orange-300",
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                  s.state === "done" && "border-orange-500 bg-orange-500 text-white",
                  s.state === "current" && "border-orange-500",
                  s.state === "todo" && "border-slate-300",
                )}
              >
                {s.state === "done" && <CircleCheck className="size-3.5" />}
              </span>
              <span className={cn(s.state === "todo" && "text-muted-foreground", s.state === "current" && "font-semibold")}>
                {s.label}
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex items-center justify-between rounded-xl bg-primary px-4 py-3 text-primary-foreground">
          <span className="font-semibold">Resume: Tracking risks</span>
          <ArrowRight className="size-4" />
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-14 pb-16 sm:px-6 lg:grid-cols-2 lg:pt-24 lg:pb-24">
        <div className="space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-semibold text-primary ring-1 ring-primary/20">
            <span className="size-2 rounded-full bg-orange-500" /> Guided professional learning
          </p>
          <h1 className="text-4xl leading-[1.08] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Online learning that always knows <span className="text-primary">what&apos;s next</span>.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            LearnLoop turns a pile of videos and PDFs into a clear path: learn a lesson, check it with a quiz, review
            what you missed, and keep going — with your progress always in sight.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/courses" className={buttonVariants({ size: "xl" })}>
              Browse courses <ArrowRight data-icon="inline-end" />
            </Link>
            <Link href="/login" className={buttonVariants({ size: "xl", variant: "outline" })}>
              Sign in
            </Link>
          </div>
          <div className="max-w-sm pt-2">
            <ProgressBar value={72} label="Example learner progress" showValue />
            <p className="mt-1.5 text-xs text-muted-foreground">Progress you can see, on every screen.</p>
          </div>
        </div>
        <HeroCard />
      </section>

      <section className="border-y bg-white/70">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight">The loop that keeps learners moving</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-2xl border bg-white p-6 shadow-xs">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
                    <step.icon className="size-5" aria-hidden />
                  </span>
                  <span className="text-sm font-bold text-orange-600">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
                <p className="mt-1.5 text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight">Built for everyone in the room</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r.title} className="rounded-2xl bg-white p-6 ring-1 ring-border">
              <r.icon className="size-6 text-primary" aria-hidden />
              <h3 className="mt-3 text-lg font-bold">{r.title}</h3>
              <p className="mt-1.5 text-muted-foreground">{r.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-500 px-6 py-12 text-center text-white sm:px-12">
          <h2 className="text-3xl font-bold tracking-tight">Ready for your next step?</h2>
          <p className="mx-auto mt-2 max-w-xl text-violet-100">
            Pick a course and LearnLoop will show you exactly where to start.
          </p>
          <Link href="/courses" className={cn(buttonVariants({ size: "xl", variant: "secondary" }), "mt-6")}>
            Explore the catalog <ArrowRight data-icon="inline-end" />
          </Link>
        </div>
      </section>
    </>
  );
}
