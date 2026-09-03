import dotenv from "dotenv"

dotenv.config()

const bool = (value, fallback = false) => {
  if (value === undefined || value === "") return fallback
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase())
}

const int = (value, fallback) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

const list = (value, fallback = []) => {
  if (!value) return fallback
  return String(value)
    .split(",")
    .map((entry) => entry.trim().replace(/\/$/, ""))
    .filter(Boolean)
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  port: int(process.env.PORT, 8000),

  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/gdg_recruitment",

  corsOrigins: list(process.env.CORS_ORIGINS, [
    "http://localhost:5173",
    "http://localhost:5174"
  ]),

  /**
   * Hostname suffixes accepted in addition to the exact origins above.
   * Tunnel providers mint a new hostname on every restart, so pinning exact
   * URLs there means re-editing .env constantly. Empty by default - a
   * production deployment should list its real origins and nothing else.
   */
  corsOriginSuffixes: list(process.env.CORS_ORIGIN_SUFFIXES, []),

  /**
   * Email domains eligible to sit the test, e.g. "thapar.edu".
   *
   * When set, anyone signing in with an address in these domains is admitted -
   * no per-candidate whitelisting needed. Subdomains count, so "thapar.edu"
   * also admits "student.thapar.edu".
   *
   * The Allowed collection still applies on top, as an exceptions list for
   * addresses outside these domains (guests, organisers testing with a
   * personal account). Leave this empty to fall back to whitelist-only.
   */
  allowedEmailDomains: list(process.env.ALLOWED_EMAIL_DOMAINS, []).map((d) =>
    d.toLowerCase().replace(/^@/, "")
  ),

  jwtSecret: process.env.JWT_SECRET,
  adminPassword: process.env.ADMIN_PASSWORD,
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH,

  allowInsecureDevLogin: bool(process.env.AUTH_ALLOW_INSECURE_DEV_LOGIN, false),
  maxViolations: int(process.env.MAX_VIOLATIONS, 4),

  /**
   * Return stack traces in error responses. Defaults to on only for an explicit
   * development NODE_ENV, and is forced off in production, so a deployment that
   * never sets NODE_ENV still fails closed.
   */
  exposeStackTraces: bool(
    process.env.EXPOSE_STACK_TRACES,
    process.env.NODE_ENV === "development"
  ) && process.env.NODE_ENV !== "production"
}

/**
 * Fails fast on a misconfigured deployment instead of surfacing the problem
 * as a confusing 500 on the first request.
 */
export const assertEnv = () => {
  const problems = []

  if (!env.jwtSecret || env.jwtSecret.length < 16) {
    problems.push("JWT_SECRET must be set to a string of at least 16 characters")
  }

  if (!env.adminPassword && !env.adminPasswordHash) {
    problems.push("Either ADMIN_PASSWORD or ADMIN_PASSWORD_HASH must be set")
  }

  if (env.isProduction) {
    if (env.allowInsecureDevLogin) {
      problems.push("AUTH_ALLOW_INSECURE_DEV_LOGIN must be false in production")
    }
    if (env.adminPassword && !env.adminPasswordHash) {
      console.warn(
        "[env] WARNING: using a plaintext ADMIN_PASSWORD in production. Set ADMIN_PASSWORD_HASH instead."
      )
    }
  }

  if (problems.length) {
    throw new Error(`Invalid environment configuration:\n  - ${problems.join("\n  - ")}`)
  }
}
