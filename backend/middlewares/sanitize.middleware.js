const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"])

function sanitizeInPlace(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 10) return

  if (Array.isArray(node)) {
    for (const item of node) sanitizeInPlace(item, depth + 1)
    return
  }

  for (const key of Object.keys(node)) {
    // Strip Mongo operator injection and prototype pollution attempts.
    if (key.startsWith("$") || FORBIDDEN_KEYS.has(key)) {
      delete node[key]
      continue
    }
    sanitizeInPlace(node[key], depth + 1)
  }
}

export function sanitizeRequest(req, _res, next) {
  sanitizeInPlace(req.body)

  // req.params is intentionally not touched here: this middleware is mounted
  // app-wide, before any router has matched, so req.params is always empty at
  // this point. Route params are plain strings from the URL and cannot carry
  // operator keys or nested objects, so there is nothing to strip.

  // Query is handled by normalizeQuery below, which must run first.
  sanitizeInPlace(req.query)

  next()
}

/** Rejects non-JSON bodies on mutating verbs. */
export function enforceJson(req, res, next) {
  if (!["POST", "PUT", "PATCH"].includes(req.method)) return next()

  const type = req.headers["content-type"] || ""
  if (!type.includes("application/json")) {
    return res
      .status(415)
      .json({ success: false, message: "Unsupported Media Type - send application/json" })
  }
  next()
}

/**
 * Materialises req.query as a plain own property, collapsing duplicated
 * parameters on the way.
 *
 * Express 5 exposes req.query as a prototype GETTER that re-parses the query
 * string on every access, so mutating what it returns is silently discarded -
 * the previous version of this middleware, and the query branch of
 * sanitizeRequest, both did nothing at all. Defining an own property shadows
 * the getter, so later reads see the cleaned object and downstream
 * sanitisation actually sticks.
 *
 * Collapsing duplicates also keeps `?search=a&search=b` from handing a
 * controller an array where it expects a string.
 *
 * Must be mounted BEFORE sanitizeRequest.
 */
export function normalizeQuery(req, _res, next) {
  const source = req.query || {}
  const normalized = {}

  for (const key of Object.keys(source)) {
    const value = source[key]
    normalized[key] = Array.isArray(value) ? value[0] : value
  }

  Object.defineProperty(req, "query", {
    value: normalized,
    writable: true,
    configurable: true,
    enumerable: true
  })

  next()
}

/** Previous name, kept so existing imports keep working. */
export const hpp = normalizeQuery
