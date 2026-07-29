import { cn } from "./utils";

export type GuardianPortraitVariant = 0 | 1 | 2 | 3 | 4 | 5;

const HAIR_PATHS = [
  "M18 39c0-18 11-29 30-29 18 0 30 11 30 29v20H18V39Z",
  "M17 42c2-21 13-32 31-32 20 0 31 14 31 34l-8-8-4 24H22l-2-22-3 4Z",
  "M19 40c0-19 12-30 29-30 19 0 30 12 30 31v18H18l1-19Zm8-8c9 2 25-2 35-10",
  "M18 41c0-20 11-31 30-31 18 0 29 11 30 31l-5 19H23l-5-19Zm8-13c13 7 28 6 40-2",
  "M19 42c0-20 10-32 29-32 20 0 30 13 30 33v16H18l1-17Zm5-12c13-1 25-6 35-14",
  "M17 40c0-19 12-30 31-30 18 0 30 11 30 30v20H18l-1-20Zm9-13c10 4 25 3 37-5",
] as const;

const SHIRT_TONES = [
  "var(--primary)",
  "color-mix(in srgb, var(--success) 72%, var(--background))",
  "color-mix(in srgb, var(--warning) 62%, var(--background))",
  "color-mix(in srgb, var(--destructive) 55%, var(--background))",
  "color-mix(in srgb, var(--primary) 55%, var(--background))",
  "color-mix(in srgb, var(--success) 48%, var(--background))",
] as const;

export function guardianPortraitForIndex(index: number): GuardianPortraitVariant {
  return (Math.abs(index) % HAIR_PATHS.length) as GuardianPortraitVariant;
}

export function GuardianPortrait({
  variant = 0,
  label,
  muted = false,
  className,
}: {
  variant?: GuardianPortraitVariant | undefined;
  label?: string | undefined;
  muted?: boolean | undefined;
  className?: string | undefined;
}) {
  const hair = HAIR_PATHS[variant];
  const shirt = SHIRT_TONES[variant];
  const older = variant === 2 || variant === 5;

  return (
    <svg
      viewBox="0 0 96 96"
      className={cn("guardian-portrait", muted && "guardian-portrait--muted", className)}
      role="img"
      aria-label={label}
    >
      {label ? <title>{label}</title> : null}
      <circle cx="48" cy="48" r="46" className="guardian-portrait__paper" />
      <path d={hair} className="guardian-portrait__hair" />
      <ellipse cx="48" cy="45" rx="22" ry="25" className="guardian-portrait__skin" />
      <path d="M9 96c2-22 16-34 39-34s37 12 39 34H9Z" fill={shirt} />
      <path d="M37 43c2-2 5-2 7 0M52 43c2-2 5-2 7 0" className="guardian-portrait__detail" />
      <path d="M42 54c4 3 8 3 12 0" className="guardian-portrait__detail" />
      {older ? (
        <>
          <path
            d="M29 42c5-4 11-4 16 0M51 42c5-4 11-4 16 0"
            className="guardian-portrait__detail"
          />
          <path d="M48 42v5" className="guardian-portrait__detail" />
        </>
      ) : null}
      {variant === 1 || variant === 4 ? (
        <path d="M25 31c8 1 15-3 21-10 7 8 15 12 25 12" className="guardian-portrait__highlight" />
      ) : null}
    </svg>
  );
}
