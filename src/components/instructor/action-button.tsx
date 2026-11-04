import { ConfirmSubmit } from "@/components/forms/confirm-submit";
import { Button } from "@/components/ui/button";

/** A tiny icon button wrapped in its own form so it works as a plain server-action post. */
export function ActionButton({
  action,
  label,
  children,
  confirm,
  variant = "ghost",
  disabled,
}: {
  action: () => Promise<void>;
  label: string;
  children: React.ReactNode;
  confirm?: string;
  variant?: "ghost" | "outline" | "destructive";
  disabled?: boolean;
}) {
  return (
    <form action={action}>
      {confirm ? (
        <ConfirmSubmit message={confirm} size="icon-sm" variant={variant} aria-label={label} title={label} disabled={disabled}>
          {children}
        </ConfirmSubmit>
      ) : (
        <Button type="submit" size="icon-sm" variant={variant} aria-label={label} title={label} disabled={disabled}>
          {children}
        </Button>
      )}
    </form>
  );
}
