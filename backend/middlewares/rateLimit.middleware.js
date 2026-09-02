/**
 * A dependency-free fixed-window rate limiter backed by an in-process Map.
 *
 * Adequate for a single-instance recruitment drive. Swap the store for Redis if
 * the API is ever scaled horizontally, since counters are per-process.
 */
const store = new Map()
const SWEEP_INTERVAL_MS = 5 * 60_000

const sweep = () => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.reset) store.delete(key)
  }
}

const sweeper = setInterval(sweep, SWEEP_INTERVAL_MS)
sweeper.unref?.()

const keyFor = (req, bucket) => `${bucket}:${req.ip || req.socket?.remoteAddress || "unknown"}`

export function rateLimit({ windowMs = 60_000, max = 60, bucket = "global" } = {}) {
  return (req, res, next) => {
    const key = keyFor(req, bucket)
    const now = Date.now()

    let entry = store.get(key)
    if (!entry || now > entry.reset) {
      entry = { count: 0, reset: now + windowMs }
      store.set(key, entry)
    }

    entry.count += 1

    res.setHeader("X-RateLimit-Limit", String(max))
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - entry.count)))
    res.setHeader("X-RateLimit-Reset", String(Math.floor(entry.reset / 1000)))

    if (entry.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.reset - now) / 1000)))
      return res
        .status(429)
        .json({ success: false, message: "Too many requests, please slow down" })
    }

    next()
  }
}

export const limitAuth = rateLimit({ windowMs: 60_000, max: 20, bucket: "auth" })
export const limitApi = rateLimit({ windowMs: 60_000, max: 120, bucket: "api" })
// Autosave fires roughly every 15s per candidate, so this ceiling is generous.
export const limitAutosave = rateLimit({ windowMs: 60_000, max: 60, bucket: "autosave" })
export const limitAdminAuth = rateLimit({ windowMs: 15 * 60_000, max: 10, bucket: "admin-auth" })
