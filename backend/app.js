import express from "express"
import cors from "cors"
import helmet from "helmet"
import cookieParser from "cookie-parser"
import mongoose from "mongoose"

import { env } from "./config/env.js"
import userRoutes from "./routes/user.routes.js"
import adminRoutes from "./routes/admin.routes.js"
import { limitIpBurst } from "./middlewares/rateLimit.middleware.js"
import { enforceJson, normalizeQuery, sanitizeRequest } from "./middlewares/sanitize.middleware.js"
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware.js"

export const createApp = () => {
  const app = express()

  app.disable("x-powered-by")
  app.set("trust proxy", 1)

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      crossOriginResourcePolicy: { policy: "cross-origin" }
    })
  )

  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin and non-browser callers (curl, health checks) send no Origin.
        if (!origin) return callback(null, true)

        const normalized = origin.replace(/\/$/, "")
        if (env.corsOrigins.includes(normalized)) return callback(null, true)

        // Suffix matches let a tunnel through without pinning the exact
        // hostname, which quick tunnels regenerate on every restart.
        const host = (() => {
          try {
            return new URL(normalized).hostname
          } catch {
            return ""
          }
        })()

        if (env.corsOriginSuffixes.some((suffix) => host.endsWith(suffix))) {
          return callback(null, true)
        }

        // A blocked origin is a client problem, not a server fault. Without an
        // explicit status this surfaced as a 500 "Internal server error", which
        // is both wrong and actively misleading to debug.
        const error = new Error(
          `Origin not allowed: ${origin}. Add it to CORS_ORIGINS in backend/.env.`
        )
        error.statusCode = 403
        return callback(error)
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      credentials: true
    })
  )

  app.use(express.json({ limit: "512kb" }))
  app.use(cookieParser())
  // Must precede sanitizeRequest: it turns req.query into a real own property.
  app.use(normalizeQuery)
  app.use(sanitizeRequest)
  app.use(enforceJson)

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("X-Frame-Options", "DENY")
    res.setHeader("Referrer-Policy", "no-referrer")
    next()
  })

  app.get(["/api", "/api/health"], limitIpBurst, (_req, res) => {
    const states = ["disconnected", "connected", "connecting", "disconnecting"]
    res.json({
      success: true,
      message: "GDG Recruitment Portal API",
      status: "ok",
      database: states[mongoose.connection.readyState] || "unknown",
      environment: env.nodeEnv,
      timestamp: new Date().toISOString()
    })
  })

  // Per-IP backstop only; the real per-candidate limit lives inside the router.
  app.use("/api/user", limitIpBurst, userRoutes)
  app.use("/api/admin", limitIpBurst, adminRoutes)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
