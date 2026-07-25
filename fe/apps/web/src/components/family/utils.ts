type ClassValue = string | false | null | undefined;

/** FamilyWallet-local class helper. This design system has no shared UI-package dependency. */
export function cn(...values: ClassValue[]) {
  return values.filter(Boolean).join(" ");
}
