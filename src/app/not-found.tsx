import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="text-sm font-bold tracking-wider text-primary uppercase">404</p>
      <h1 className="text-3xl font-extrabold tracking-tight">We can&apos;t find that page</h1>
      <p className="text-muted-foreground">It may have moved, been unpublished, or you may not have access to it.</p>
      <div className="flex gap-3">
        <Link href="/courses" className={buttonVariants({ size: "xl" })}>
          Browse courses
        </Link>
        <Link href="/dashboard" className={buttonVariants({ size: "xl", variant: "outline" })}>
          My learning
        </Link>
      </div>
    </main>
  );
}
