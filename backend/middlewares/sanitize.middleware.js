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
  sanitizeInPlace(req.params)
  // Express 5 exposes req.query through a getter, so mutate rather than reassign.
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

/** Collapses duplicated query parameters (HTTP parameter pollution). */
export function hpp(req, _res, next) {
  for (const key of Object.keys(req.query || {})) {
    const value = req.query[key]
    if (Array.isArray(value)) req.query[key] = value[0]
  }
  next()
}
