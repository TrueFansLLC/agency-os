// Persistence layer — currently uses localStorage.
// To move to a real database, replace loadStorage / saveStorage with
// API fetch calls. Nothing outside this file needs to change.

const KEYS = {
  accounts: "agency_accounts_v1",
  creators: "agency_creators_v1",
  markets:  "agency_markets_v1",
} as const

type StorageKey = keyof typeof KEYS

export function loadStorage<T>(key: StorageKey, fallback: T): T {
  try {
    const raw = localStorage.getItem(KEYS[key])
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function saveStorage<T>(key: StorageKey, value: T): void {
  try {
    localStorage.setItem(KEYS[key], JSON.stringify(value))
  } catch {}
}
