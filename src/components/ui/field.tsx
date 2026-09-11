import { cn } from "@/lib/utils/cn";
import { FormMessage } from "./form-message";
import { Label } from "./label";

/** Label + control + hint/error, with ids wired for aria-describedby. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor: string;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      <FormMessage id={`${htmlFor}-error`}>{error}</FormMessage>
    </div>
  );
}

/** aria props for a control inside <Field>. */
export function describedBy(id: string, error?: string) {
  return { "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${id}-error` : `${id}-hint` };
}
