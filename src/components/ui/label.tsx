import { cn } from "@/lib/utils/cn";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-[13px] font-medium text-frost", className)} {...props} />;
}
