import { cn } from "@/lib/utils/cn";

export function Textarea({ className, rows = 4, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      rows={rows}
      className={cn(
        "w-full rounded-lg border border-line bg-night px-3 py-2 text-sm text-frost placeholder:text-muted/60",
        "transition-colors focus-visible:border-leaf focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf/30",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
}
