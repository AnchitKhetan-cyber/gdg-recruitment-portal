import { ApiError } from "./apiError.js"

/**
 * Runs a zod schema over a request property and returns the parsed value,
 * translating a failure into a 400 with a readable field list.
 */
export const parseOrThrow = (schema, value, label = "input") => {
  const result = schema.safeParse(value)
  if (result.success) return result.data

  const details = result.error.issues.map((issue) => ({
    field: issue.path.join(".") || label,
    message: issue.message
  }))

  throw ApiError.badRequest(
    details.map((d) => `${d.field}: ${d.message}`).join(", "),
    details
  )
}

/** Express middleware form: validates req.body and replaces it with the parsed value. */
export const validateBody = (schema) => (req, _res, next) => {
  try {
    req.body = parseOrThrow(schema, req.body, "body")
    next()
  } catch (error) {
    next(error)
  }
}

/** Express middleware form: validates req.query into req.validatedQuery. */
export const validateQuery = (schema) => (req, _res, next) => {
  try {
    req.validatedQuery = parseOrThrow(schema, req.query, "query")
    next()
  } catch (error) {
    next(error)
  }
}
