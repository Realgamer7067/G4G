"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Two-step submit for destructive actions: the first click arms it, the second submits.
 * Avoids browser confirm() dialogs, which block assistive tech and automation alike.
 */
export function ConfirmSubmit({
  label,
  confirmLabel,
  variant = "danger",
  size = "sm",
  disabled,
}: {
  label: string;
  confirmLabel: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <Button type="button" variant={variant} size={size} disabled={disabled} onClick={() => setArmed(true)}>
        {label}
      </Button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button type="submit" variant="danger" size={size} disabled={disabled} autoFocus>
        {confirmLabel}
      </Button>
      <Button type="button" variant="ghost" size={size} onClick={() => setArmed(false)}>
        Cancel
      </Button>
    </span>
  );
}
