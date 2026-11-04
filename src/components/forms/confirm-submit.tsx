"use client";

import { Button } from "@/components/ui/button";

/** A submit button that asks "are you sure?" before the surrounding form posts. */
export function ConfirmSubmit({
  message,
  children,
  ...props
}: { message: string } & React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="submit"
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      {...props}
    >
      {children}
    </Button>
  );
}
