import { Icon } from "./icon";

export function TimelockCountdown({
  countdown,
  absolute,
  label,
  large = false,
}: {
  countdown: string;
  absolute: string;
  label?: string | undefined;
  large?: boolean;
}) {
  return (
    <section className="rounded-md border bg-card p-5 text-center shadow-sm">
      <div className="mb-3 flex items-center justify-center gap-2 text-muted-foreground">
        <Icon name="clock" size={20} />
        {label ? (
          <span className="font-medium text-xs uppercase tracking-[0.06em]">{label}</span>
        ) : null}
      </div>
      <p
        className={
          large
            ? "money-amount font-mono font-semibold text-4xl tracking-tight"
            : "money-amount font-mono font-semibold text-2xl"
        }
      >
        {countdown}
      </p>
      <p className="mt-2 text-muted-foreground text-sm">{absolute}</p>
    </section>
  );
}
