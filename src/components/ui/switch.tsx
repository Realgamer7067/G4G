import { cn } from "@/lib/utils/cn";

/** A checkbox that looks like a switch. Submits "on" when checked, like any checkbox. */
export function Switch({
  label,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & { label: React.ReactNode }) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-3 text-sm has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60", className)}>
      <input type="checkbox" role="switch" className="peer sr-only" {...props} />
      <span
        aria-hidden="true"
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full border border-line bg-night transition-colors",
          "after:absolute after:left-0.5 after:top-0.5 after:size-3.5 after:rounded-full after:bg-muted after:transition-transform",
          "peer-checked:border-leaf/60 peer-checked:bg-leaf/25 peer-checked:after:translate-x-4 peer-checked:after:bg-leaf",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-mint",
        )}
      />
      <span>{label}</span>
    </label>
  );
}
