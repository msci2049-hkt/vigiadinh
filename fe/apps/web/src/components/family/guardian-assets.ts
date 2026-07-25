export const GUARDIAN_AVATAR_NAMES = [
  "mom",
  "brother",
  "aunt",
  "uncle",
  "sister",
  "grandfather",
] as const;

export function guardianAvatarForIndex(index: number, size: 104 | 160 = 104) {
  const name = GUARDIAN_AVATAR_NAMES[index % GUARDIAN_AVATAR_NAMES.length] ?? "mom";
  const base = `/assets/avatars/${name}-${size}`;
  return {
    avifSrc: `${base}.avif`,
    src: `${base}.webp`,
  };
}
