import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "./utils";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "ghost" | "link";

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: ComponentProps<"span"> & { asChild?: boolean; variant?: BadgeVariant }) {
  const Comp = asChild ? Slot.Root : "span";
  const variants: Record<BadgeVariant, string> = {
    default: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    destructive: "bg-destructive text-destructive-foreground",
    outline: "border-border text-foreground",
    ghost: "text-foreground",
    link: "text-foreground underline underline-offset-4",
  };

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(
        "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 font-medium text-xs whitespace-nowrap",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
