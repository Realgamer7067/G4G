import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <span className="relative block">
      <select
        className={cn(
          "h-10 w-full appearance-none rounded-lg border border-line bg-night pl-3 pr-9 text-sm text-frost",
          "transition-colors focus-visible:border-leaf focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf/30",
          "aria-[invalid=true]:border-danger",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
    </span>
  );
}
