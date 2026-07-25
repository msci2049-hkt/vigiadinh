import type { ReactNode } from "react";
import { Icon } from "./icon";

export function Sheet({
  title,
  children,
  visible = true,
}: {
  title: string;
  children?: ReactNode;
  visible?: boolean;
}) {
  if (!visible) return null;
  return (
    <section className="-mx-6 mt-4 rounded-t-lg border border-b-0 bg-card px-6 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] text-center shadow-[var(--shadow-sheet)]">
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-border" />
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-accent">
        <Icon name="fingerprint" size={32} />
      </div>
      <h2 className="mt-4 font-semibold text-lg">{title}</h2>
      {children ? <div className="mt-2 text-muted-foreground text-sm">{children}</div> : null}
    </section>
  );
}
