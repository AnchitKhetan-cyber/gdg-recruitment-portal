/**
 * Fixed-window rate limiting.
 *
 * The subtlety that matters for a recruitment drive: an entire campus shares
 * one public IP. Limiting authenticated traffic per IP means 1000 candidates
 * compete for one allowance and nearly all of them are rejected - measured at
 * 880/1000 blocked before this was keyed per user.
 *
 * So: authenticated routes are limited PER CANDIDATE, which is what actually
 * protects the server from any one client, and a much looser per-IP ceiling
 * remains as a backstop against a single machine flooding the API.
 *
 * Counters are per-process. Behind more than one instance, move the store to
 * Redis or the effective limits multiply by the instance count.
 */
const store = new Map()
const SWEEP_INTERVAL_MS = 60_000

const sweep = () => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.reset) store.delete(key)
  }
}

const sweeper = setInterval(sweep, SWEEP_INTERVAL_MS)
sweeper.unref?.()

/** Exposed for tests and for an operational health check. */
export const rateLimitStoreSize = () => store.size

const ipOf = (req) => req.ip || req.socket?.remoteAddress || "unknown"

/**
 * @param {object}   options
 * @param {function} options.keyBy  Derives the bucket key from the request.
 *                                  Return null to skip limiting entirely.
 */
export function rateLimit({
  windowMs = 60_000,
  max = 60,
  bucket = "global",
  keyBy = ipOf
} = {}) {
  return (req, res, next) => {
    const identity = keyBy(req)
    if (identity === null) return next()

    const key = `${bucket}:${identity}`
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

/**
 * Per-candidate limit. Must be mounted AFTER authMiddleware so req.user is
 * populated and therefore trustworthy - keying on an unverified cookie would
 * let a caller mint identities to escape the limit.
 *
 * An attempt sends roughly 5 autosaves a minute, so 120 leaves ample headroom
 * for retries and impatient clicking.
 */
export const limitPerUser = rateLimit({
  windowMs: 60_000,
  max: 120,
  bucket: "user",
  keyBy: (req) => req.user?.id || ipOf(req)
})

/**
 * Backstop against one machine flooding the API.
 *
 * A whole campus sits behind one NAT IP, so this ceiling is the entire
 * cohort's shared budget - not one person's. It must clear peak aggregate
 * load with room to spare: ~3000 candidates, each ~10 requests/min (five
 * autosaves plus navigation), then a submit clump at the deadline, is on the
 * order of 30-40k/min. 60k leaves headroom for that while still cutting off a
 * runaway script. The per-candidate limit above is what actually contains one
 * abuser; this only stops a flood.
 *
 * Configurable via IP_BURST_MAX so a bigger drive can raise it without a code
 * change. Behind more than one API instance, divide by the instance count or
 * move the store to Redis.
 */
export const limitIpBurst = rateLimit({
  windowMs: 60_000,
  max: Number.parseInt(process.env.IP_BURST_MAX, 10) || 60_000,
  bucket: "ip",
  keyBy: ipOf
})

/**
 * Sign-in. Generous because a whole cohort signs in within a few minutes from
 * one address, and because the endpoint already requires a Firebase-signed
 * token that an attacker cannot forge.
 */
export const limitAuth = rateLimit({ windowMs: 60_000, max: 600, bucket: "auth" })

/**
 * Admin password login stays strictly per IP: it is the one endpoint where a
 * guessable secret is checked, there are a handful of legitimate admins, and
 * brute force is the real threat.
 */
export const limitAdminAuth = rateLimit({ windowMs: 15 * 60_000, max: 10, bucket: "admin-auth" })

/** Kept for compatibility with existing imports. */
export const limitApi = limitIpBurst
export const limitAutosave = limitPerUser
