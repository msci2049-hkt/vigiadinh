import { cn } from "./utils";

export type GuardianPortraitVariant = 0 | 1 | 2 | 3 | 4 | 5;

const PORTRAIT_SOURCES = [
  "/assets/characters/guardians/guardian-1.webp",
  "/assets/characters/guardians/guardian-2.webp",
  "/assets/characters/guardians/guardian-3.webp",
  "/assets/characters/guardians/guardian-4.webp",
  "/assets/characters/guardians/guardian-5.webp",
  "/assets/characters/guardians/guardian-6.webp",
] as const;

export function guardianPortraitForIndex(index: number): GuardianPortraitVariant {
  return (Math.abs(index) % PORTRAIT_SOURCES.length) as GuardianPortraitVariant;
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
  return (
    <img
      src={PORTRAIT_SOURCES[variant]}
      alt={label ?? ""}
      width={256}
      height={256}
      loading="lazy"
      decoding="async"
      className={cn("guardian-portrait", muted && "guardian-portrait--muted", className)}
    />
  );
}
