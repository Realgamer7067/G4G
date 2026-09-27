import { cn } from "@/lib/utils/cn";

export const BUTTON_VARIANTS = {
  primary: "bg-leaf text-night hover:bg-[#72d48e] hover:-translate-y-0.5 shadow-[0_10px_30px_-12px_rgb(92_201_123/0.7)] hover:shadow-[0_16px_36px_-14px_rgb(92_201_123/0.85)]",
  secondary: "border border-line bg-raised text-frost hover:bg-[#1d3527] hover:border-leaf/40",
  ghost: "text-muted hover:bg-raised hover:text-frost",
  danger: "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20",
} as const;

export const BUTTON_SIZES = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-[15px]" } as const;

export const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[background-color,border-color,transform,box-shadow] duration-200 ease-out active:scale-[0.985] active:translate-y-0 disabled:pointer-events-none disabled:opacity-50";

const VARIANTS = BUTTON_VARIANTS;
const SIZES = BUTTON_SIZES;

export type ButtonProps = React.ComponentProps<"button"> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
};

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        BUTTON_BASE,
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
