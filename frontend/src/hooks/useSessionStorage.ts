import { useState, useEffect } from 'react'

/**
 * Persists state in sessionStorage.
 * SDD/RAD requirement: questionnaire answers must survive browser refresh (UC-03).
 * Uses sessionStorage (not localStorage) — cleared when tab closes.
 */
export function useSessionStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.sessionStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(storedValue))
    } catch {
      // sessionStorage full or private mode — fail silently
    }
  }, [key, storedValue])

  const clear = () => {
    window.sessionStorage.removeItem(key)
    setStoredValue(initialValue)
  }

  return [storedValue, setStoredValue, clear] as const
}
