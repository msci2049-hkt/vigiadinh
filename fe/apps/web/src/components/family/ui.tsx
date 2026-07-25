import { LoaderCircle } from "lucide-react";
import { Slot } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./utils";

export type FamilyButtonVariant =
  | "default"
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "destructive"
  | "link";

export type FamilyButtonSize =
  | "default"
  | "xs"
  | "sm"
  | "lg"
  | "icon"
  | "icon-xs"
  | "icon-sm"
  | "icon-lg";

export function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  loadingLabel,
  disabled,
  onClick,
  tabIndex,
  children,
  ...props
}: ComponentProps<"button"> & {
  variant?: FamilyButtonVariant | undefined;
  size?: FamilyButtonSize | undefined;
  asChild?: boolean | undefined;
  loading?: boolean | undefined;
  loadingLabel?: ReactNode;
}) {
  const Comp = asChild ? Slot.Root : "button";
  const normalizedVariant =
    variant === "default"
      ? "primary"
      : variant === "outline"
        ? "secondary"
        : variant === "destructive"
          ? "danger"
          : variant;
  const isDisabled = Boolean(disabled || loading);

  return (
    <Comp
      {...props}
      {...(asChild ? { "aria-disabled": isDisabled || undefined } : { disabled: isDisabled })}
      onClick={(event) => {
        if (isDisabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      tabIndex={asChild && isDisabled ? -1 : tabIndex}
      data-slot="family-button"
      data-variant={normalizedVariant}
      data-size={size}
      aria-busy={loading || undefined}
      className={cn(
        "fw-button",
        `fw-button--${normalizedVariant}`,
        `fw-button--${size}`,
        className,
      )}
    >
      {loading && !asChild ? (
        <>
          <LoaderCircle aria-hidden className="fw-button__spinner" />
          <span>{loadingLabel ?? children}</span>
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="family-card" className={cn("fw-card", className)} {...props} />;
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="family-card-header" className={cn("fw-card-header", className)} {...props} />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="family-card-title" className={cn("fw-card-title", className)} {...props} />
  );
}

export function CardDescription({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="family-card-description"
      className={cn("fw-card-description", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="family-card-content" className={cn("fw-card-content", className)} {...props} />
  );
}

export function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input type={type} data-slot="family-input" className={cn("fw-input", className)} {...props} />
  );
}

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      data-slot="family-skeleton"
      className={cn("fw-skeleton", className)}
      {...props}
    />
  );
}
