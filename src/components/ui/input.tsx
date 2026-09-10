import { cn } from "@/lib/utils/cn";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-line bg-night px-3 text-sm text-frost placeholder:text-muted/60",
        "transition-colors focus-visible:border-leaf focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf/30",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
}
