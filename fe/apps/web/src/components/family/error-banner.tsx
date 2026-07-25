import { cn } from "@repo/ui";
import type { ReactNode } from "react";
import { Icon } from "./icon";

const STYLES = {
  info: "border-border bg-card",
  warn: "border-warning bg-accent",
  pending: "border-border bg-card",
  error: "border-error bg-card",
} as const;

export function ErrorBanner({
  type,
  title,
  children,
}: {
  type: keyof typeof STYLES;
  title: string;
  children?: ReactNode;
}) {
  const icon =
    type === "pending"
      ? "loader"
      : type === "error"
        ? "xCircle"
        : type === "warn"
          ? "alertTriangle"
          : "info";
  return (
    <section
      className={cn("flex gap-3 rounded-md border p-4 shadow-sm", STYLES[type])}
      role={type === "error" ? "alert" : "status"}
    >
      <Icon name={icon} size={24} className={type === "pending" ? "animate-spin" : undefined} />
      <div className="min-w-0 space-y-1">
        <h2 className="font-semibold text-foreground text-sm">{title}</h2>
        {children ? (
          <div className="text-muted-foreground text-sm leading-relaxed">{children}</div>
        ) : null}
      </div>
    </section>
  );
}
