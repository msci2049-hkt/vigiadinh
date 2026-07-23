import { useEffect, useState } from "react";

/**
 * Debounce a fast-changing value (search inputs → server queries).
 * The timer is cleaned up on unmount/re-run — no leaked timeouts.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
