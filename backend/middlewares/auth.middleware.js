import jwt from "jsonwebtoken"
import { env } from "../config/env.js"
import { verifyFirebaseToken } from "../config/firebase.js"
import { ApiError } from "../utils/apiError.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const CANDIDATE_TOKEN_TTL = "7d"
const ADMIN_TOKEN_TTL = "24h"

export const SESSION_COOKIE = "session"
export const ADMIN_COOKIE = "adminToken"

/** Cookie flags shared by both sessions. */
export const cookieOptions = (maxAgeMs) => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? "none" : "lax",
  path: "/",
  maxAge: maxAgeMs
})

export const generateToken = (user) => {
  if (!user?._id || !user?.email) {
    throw new Error("Invalid user data for token generation")
  }

  return jwt.sign(
    { id: user._id.toString(), email: user.email, uid: user.firebaseUid, role: "candidate" },
    env.jwtSecret,
    { expiresIn: CANDIDATE_TOKEN_TTL }
  )
}

export const generateAdminToken = (email = null) =>
  jwt.sign({ role: "admin", isAdmin: true, email }, env.jwtSecret, {
    expiresIn: ADMIN_TOKEN_TTL
  })

/**
 * Verifies the Firebase ID token on the Authorization header. Used only by the
 * sign-in endpoint; every later request rides the httpOnly session cookie.
 */
export const firebaseAuthMiddleware = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization

  if (!header?.startsWith("Bearer ")) {
    throw ApiError.unauthorized("Authorization header missing or malformed")
  }

  const idToken = header.slice(7).trim()
  if (!idToken) {
    throw ApiError.unauthorized("Firebase ID token missing")
  }

  try {
    req.firebaseUser = await verifyFirebaseToken(idToken)
  } catch (error) {
    console.error("[auth] firebase token rejected:", error.message)
    throw ApiError.unauthorized("Invalid or expired Google sign-in token")
  }

  next()
})

/** Candidate session guard. */
export const authMiddleware = (req, _res, next) => {
  const token = req.cookies?.[SESSION_COOKIE]
  if (!token) return next(ApiError.unauthorized("Authentication token missing"))

  let decoded
  try {
    decoded = jwt.verify(token, env.jwtSecret)
  } catch {
    return next(ApiError.forbidden("Invalid or expired authentication token"))
  }

  if (!decoded?.id || !decoded?.email || decoded.role !== "candidate") {
    return next(ApiError.forbidden("Token does not contain valid candidate data"))
  }

  req.user = { id: decoded.id, email: decoded.email, uid: decoded.uid }
  next()
}

/** Admin session guard. */
export const adminAuthMiddleware = (req, _res, next) => {
  const token = req.cookies?.[ADMIN_COOKIE]
  if (!token) return next(ApiError.unauthorized("Admin authentication token missing"))

  let decoded
  try {
    decoded = jwt.verify(token, env.jwtSecret)
  } catch {
    return next(ApiError.forbidden("Invalid or expired admin token"))
  }

  if (!decoded?.isAdmin || decoded.role !== "admin") {
    return next(ApiError.forbidden("Admin access required"))
  }

  req.admin = { role: decoded.role, isAdmin: decoded.isAdmin, email: decoded.email || null }
  next()
}
