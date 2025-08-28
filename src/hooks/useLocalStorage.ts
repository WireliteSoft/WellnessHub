import { useEffect, useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      if (value === null || value === undefined) {
        localStorage.removeItem(key);   // <-- key really goes away
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch {
      // ignore write errors (private mode, etc.)
    }
  }, [key, value]);

  return [value, setValue] as const;
}