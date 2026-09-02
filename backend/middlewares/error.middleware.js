import mongoose from "mongoose"
import { env } from "../config/env.js"
import { ApiError } from "../utils/apiError.js"

export const notFoundHandler = (req, res) => {
  res
    .status(404)
    .json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` })
}

/**
 * The single place where a failure becomes a JSON response. Mongoose faults are
 * translated to the right status so a validation problem never surfaces as a 500.
 */
export const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500
  let message = err.message || "Internal server error"
  let details = err.details

  if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }))
    message = details.map((d) => d.message).join(", ")
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400
    message = `Invalid value for ${err.path}`
  } else if (err.code === 11000) {
    statusCode = 409
    const field = Object.keys(err.keyValue || {})[0] || "field"
    message = `${field} already exists`
  } else if (!(err instanceof ApiError) && statusCode === 500) {
    // Never surface the internals of an unexpected fault to the client.
    message = "Internal server error"
  }

  if (statusCode >= 500) console.error("[error]", req.method, req.originalUrl, err)

  res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {}),
    ...(env.isProduction ? {} : { stack: err.stack })
  })
}
