import { useCallback, useEffect, useState } from "react";

/**
 * Small localStorage-backed piece of state. Safe for SSR: starts at
 * `initial` on the server and hydrates from storage after mount, so there's
 * no server/client markup mismatch.
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {
      /* ignore malformed storage */
    }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable (private mode, quota, etc.) */
    }
  }, [key, value, hydrated]);

  const toggleInSet = useCallback((item: string) => {
    setValue((prev) => {
      const set = new Set(prev as unknown as string[]);
      if (set.has(item)) set.delete(item);
      else set.add(item);
      return [...set] as unknown as T;
    });
  }, []);

  return { value, setValue, toggleInSet, hydrated } as const;
}
