"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-3xl font-extrabold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground">
        We couldn&apos;t load this page. Your progress is safe — it&apos;s saved as you go. Try again, or head back to the start.
      </p>
      {error.digest && <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>}
      <div className="flex gap-3">
        <Button size="xl" onClick={reset}>
          Try again
        </Button>
        <Link href="/" className={buttonVariants({ size: "xl", variant: "outline" })}>
          Go home
        </Link>
      </div>
    </main>
  );
}
