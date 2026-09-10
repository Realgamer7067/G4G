import { cn } from "@/lib/utils/cn";

const VARIANTS = {
  primary: "bg-leaf text-night hover:bg-[#72d48e] shadow-[0_10px_30px_-12px_rgb(92_201_123/0.7)]",
  secondary: "border border-line bg-raised text-frost hover:bg-[#1d3527]",
  ghost: "text-muted hover:bg-raised hover:text-frost",
  danger: "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20",
} as const;

const SIZES = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm" } as const;

export type ButtonProps = React.ComponentProps<"button"> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
};

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[background-color,transform,box-shadow] duration-200 active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
