/**
 * In-memory client cache untuk Phanix POS
 * Memungkinkan navigasi instan antar-halaman tanpa memicu loading screen berulang
 * dengan pola Stale-While-Revalidate (SWR).
 */

const memoryCache = new Map()

// Default TTL: 5 menit
const DEFAULT_TTL = 5 * 60 * 1000

export function getCache(key) {
  const item = memoryCache.get(key)
  if (!item) return null
  if (Date.now() > item.expiresAt) {
    memoryCache.delete(key)
    return null
  }
  return item.data
}

export function setCache(key, data, ttlMs = DEFAULT_TTL) {
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
    updatedAt: Date.now(),
  })
}

export function invalidateCache(pattern) {
  if (!pattern) {
    memoryCache.clear()
    return
  }
  for (const key of memoryCache.keys()) {
    if (typeof pattern === 'string' && key.startsWith(pattern)) {
      memoryCache.delete(key)
    } else if (pattern instanceof RegExp && pattern.test(key)) {
      memoryCache.delete(key)
    }
  }
}

export function clearAllCache() {
  memoryCache.clear()
}
