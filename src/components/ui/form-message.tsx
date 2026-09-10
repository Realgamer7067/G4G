import { cn } from "@/lib/utils/cn";

export function FormMessage({
  tone = "error",
  children,
  id,
}: {
  tone?: "error" | "success";
  children?: React.ReactNode;
  id?: string;
}) {
  if (!children) return null;
  return (
    <p
      id={id}
      role={tone === "error" ? "alert" : "status"}
      className={cn("text-[13px]", tone === "error" ? "text-danger" : "text-leaf")}
    >
      {children}
    </p>
  );
}
