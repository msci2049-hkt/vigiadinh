import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-3 whitespace-nowrap rounded-md font-bold text-base outline-none transition-[transform,background-color,box-shadow,opacity] duration-200 ease-out hover:-translate-y-0.5 active:translate-y-px focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-40 aria-invalid:ring-error/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        primary: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        danger: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border bg-secondary text-secondary-foreground shadow-sm hover:bg-accent",
        secondary: "border bg-secondary text-secondary-foreground shadow-sm hover:bg-accent",
        ghost: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        link: "h-auto min-h-11 px-1 text-foreground underline underline-offset-4 hover:no-underline",
      },
      size: {
        default: "h-14 px-5 has-[>svg]:px-5",
        xs: "h-11 gap-2 px-3 text-sm [&_svg:not([class*='size-'])]:size-4",
        sm: "h-11 gap-2 px-3 text-sm [&_svg:not([class*='size-'])]:size-4",
        lg: "h-16 px-6 text-lg has-[>svg]:px-5",
        icon: "size-14",
        "icon-xs": "size-11 [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-11 [&_svg:not([class*='size-'])]:size-5",
        "icon-lg": "size-14 [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  loadingLabel,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
    loadingLabel?: React.ReactNode;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading && !asChild ? (
        <>
          <LoaderCircle aria-hidden className="animate-spin" />
          {loadingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
