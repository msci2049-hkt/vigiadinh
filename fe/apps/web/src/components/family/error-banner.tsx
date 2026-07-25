import type { ReactNode } from "react";
import { Icon } from "./icon";

export function ErrorBanner({
  type,
  title,
  children,
}: {
  type: "info" | "warn" | "pending" | "error";
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
    <section className="fw-banner" data-state={type} role={type === "error" ? "alert" : "status"}>
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
