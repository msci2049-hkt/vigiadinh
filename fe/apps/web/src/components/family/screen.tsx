import type { ComponentProps, ReactNode } from "react";
import { cn } from "./utils";

export function ProductScreen({ className, ...props }: ComponentProps<"main">) {
  return <main className={cn("product-screen", className)} {...props} />;
}

export function ScreenHeader({
  title,
  description,
  display = false,
  eyebrow,
  className,
}: {
  title: string;
  description?: string | undefined;
  display?: boolean;
  eyebrow?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <header className={cn("space-y-3", className)}>
      {eyebrow ? (
        <p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.06em]">
          {eyebrow}
        </p>
      ) : null}
      <h1
        className={
          display
            ? "product-display whitespace-pre-line text-balance"
            : "product-title whitespace-pre-line text-balance"
        }
      >
        {title}
      </h1>
      {description ? <p className="product-copy text-pretty">{description}</p> : null}
    </header>
  );
}

export function PrimaryZone({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return <div className={cn("primary-zone flex flex-col gap-3", className)}>{children}</div>;
}

export function IconDisc({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-foreground">
      {children}
    </span>
  );
}

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 border-b py-3 last:border-b-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-right font-medium text-foreground text-sm">{children}</span>
    </div>
  );
}
