/**
 * An error carrying an HTTP status. Anything thrown that is not an ApiError is
 * treated as an unexpected fault and reported as a generic 500.
 */
export class ApiError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message)
    this.name = "ApiError"
    this.statusCode = statusCode
    this.details = details
    this.isOperational = true
    Error.captureStackTrace?.(this, ApiError)
  }

  static badRequest(message = "Bad request", details) {
    return new ApiError(400, message, details)
  }

  static unauthorized(message = "Authentication required") {
    return new ApiError(401, message)
  }

  static forbidden(message = "Forbidden") {
    return new ApiError(403, message)
  }

  static notFound(message = "Not found") {
    return new ApiError(404, message)
  }

  static conflict(message = "Conflict") {
    return new ApiError(409, message)
  }
}
