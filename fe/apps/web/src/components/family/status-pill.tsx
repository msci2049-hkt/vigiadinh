import { cn } from "@repo/ui";
import type { ReactNode } from "react";

const STYLES = {
  active: "border-success/20 bg-success/10 text-success",
  slow: "border-warning bg-accent text-foreground",
  offline: "border-border bg-muted text-muted-foreground",
  pending: "border-dashed border-border bg-card text-muted-foreground",
} as const;

export function StatusPill({
  state,
  children,
}: {
  state: keyof typeof STYLES;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full border px-3 font-semibold text-[0.6875rem] uppercase tracking-[0.06em]",
        STYLES[state],
      )}
    >
      {children}
    </span>
  );
}
