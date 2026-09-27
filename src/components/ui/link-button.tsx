import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { BUTTON_BASE, BUTTON_SIZES, BUTTON_VARIANTS } from "./button";

type LinkButtonProps = React.ComponentProps<typeof Link> & {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
};

/** A link styled as a button. External URLs open in a new tab. */
export function LinkButton({ variant = "primary", size = "md", className, href, ...props }: LinkButtonProps) {
  const external = typeof href === "string" && /^https?:\/\//.test(href);
  return (
    <Link
      href={href}
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...props}
    />
  );
}
