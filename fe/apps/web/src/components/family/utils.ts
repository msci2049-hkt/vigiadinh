type ClassValue = string | false | null | undefined;

/** FamilyWallet-local class helper. This design system does not depend on @repo/ui. */
export function cn(...values: ClassValue[]) {
  return values.filter(Boolean).join(" ");
}
