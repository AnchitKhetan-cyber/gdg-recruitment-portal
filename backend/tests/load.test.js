/**
 * Load test for a full recruitment drive.
 *
 *   npm run test:load                  # 1000 candidates
 *   npm run test:load -- --users 200   # smaller run
 *
 * Drives the real HTTP stack and a real mongod (in memory) through the exact
 * sequence a drive produces: everyone starts within a few minutes of each
 * other, autosaves throughout, then submits in a clump near the deadline.
 *
 * Candidate sessions are minted directly rather than through Firebase, so this
 * measures the attempt endpoints rather than Google's login latency.
 *
 * WHAT THIS DOES AND DOES NOT PROVE
 *   - it runs every request from ONE source address, which is exactly what a
 *     campus NAT looks like to the server, so per-IP limits show up here
 *   - mongod stores to RAM, so real disk I/O will be slower
 *   - client and server share a machine, so both compete for the same CPU
 *   Treat the latency numbers as optimistic and the error counts as real.
 */
import { MongoMemoryServer } from "mongodb-memory-server"
import jwt from "jsonwebtoken"

process.env.NODE_ENV = "test"
process.env.JWT_SECRET = process.env.JWT_SECRET || "load-test-secret-long-enough"
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "load-test-admin"
// Don't let the real backend/.env's password hash or domain rule leak in.
process.env.ADMIN_PASSWORD_HASH = ""
process.env.ALLOWED_EMAIL_DOMAINS = ""

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1) return fallback
  const value = Number.parseInt(process.argv[index + 1], 10)
  return Number.isFinite(value) ? value : fallback
}

const USERS = arg("users", 1000)
const AUTOSAVES_PER_USER = arg("autosaves", 5)
// How many requests may be in flight at once, so the harness does not simply
// exhaust its own sockets and report that as a server failure.
const CONCURRENCY = arg("concurrency", 100)

const { createApp } = await import("../app.js")
const { connectDataBase, disconnectDataBase } = await import("../config/db.js")
const { seed } = await import("../scripts/seed.js")
const { Allowed } = await import("../models/allowed.model.js")
const { User } = await import("../models/user.model.js")

/* ---------------------------------------------------------------- helpers */

const percentile = (sorted, p) => {
  if (!sorted.length) return 0
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[index]
}

class Metrics {
  constructor(name) {
    this.name = name
    this.latencies = []
    this.statuses = new Map()
    this.errors = 0
    this.start = performance.now()
  }

  record(status, ms) {
    this.latencies.push(ms)
    this.statuses.set(status, (this.statuses.get(status) || 0) + 1)
  }

  fail() {
    this.errors += 1
  }

  finish() {
    this.elapsed = performance.now() - this.start
  }

  get ok() {
    return this.statuses.get(200) || 0
  }

  get rateLimited() {
    return this.statuses.get(429) || 0
  }

  report() {
    const sorted = [...this.latencies].sort((a, b) => a - b)
    const total = this.latencies.length + this.errors
    const rps = total / (this.elapsed / 1000)

    const codes = [...this.statuses.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => `${code}x${count}`)
      .join(" ")

    console.log(
      `  ${this.name.padEnd(22)} ` +
        `${String(total).padStart(6)} reqs  ` +
        `${rps.toFixed(0).padStart(5)}/s  ` +
        `p50 ${percentile(sorted, 50).toFixed(0).padStart(4)}ms  ` +
        `p95 ${percentile(sorted, 95).toFixed(0).padStart(5)}ms  ` +
        `p99 ${percentile(sorted, 99).toFixed(0).padStart(5)}ms  ` +
        `[${codes}]${this.errors ? ` ERR:${this.errors}` : ""}`
    )
  }
}

/** Runs tasks with a bounded number in flight. */
const pool = async (items, limit, worker) => {
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      await worker(items[index], index)
    }
  })
  await Promise.all(runners)
}

/* ------------------------------------------------------------------ setup */

console.log(`\nLoad test: ${USERS} candidates, ${AUTOSAVES_PER_USER} autosaves each\n`)

const mongo = await MongoMemoryServer.create({ instance: { dbName: "gdg_load" } })
await connectDataBase(mongo.getUri())
await seed({ reset: true, quiet: true })

const app = createApp()
const server = app.listen(0)
await new Promise((resolve) => server.once("listening", resolve))
const base = `http://127.0.0.1:${server.address().port}`

// Provision candidates directly; signing up 1000 people is not what we measure.
console.log("  provisioning candidates...")
const people = Array.from({ length: USERS }, (_, i) => ({
  name: `Load Test ${i}`,
  email: `load${i}@example.com`,
  phone: String(9200000000 + i)
}))

await Allowed.insertMany(people, { ordered: false })
const created = await User.insertMany(
  people.map((p, i) => ({ ...p, firebaseUid: `load-uid-${i}` })),
  { ordered: false }
)

const sessions = created.map((user) =>
  jwt.sign(
    { id: user._id.toString(), email: user.email, uid: user.firebaseUid, role: "candidate" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  )
)

const call = async (path, token, body, metrics) => {
  const started = performance.now()
  try {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `session=${token}` },
      body: JSON.stringify(body || {})
    })
    const data = await response.json().catch(() => null)
    metrics.record(response.status, performance.now() - started)
    return { status: response.status, data }
  } catch (error) {
    metrics.fail()
    return { status: 0, error: error.message }
  }
}

/* ------------------------------------------------------------------- run */

console.log(`  driving load at concurrency ${CONCURRENCY}...\n`)

// Phase 1 - everyone opens the paper.
const startMetrics = new Metrics("start-quiz")
const papers = new Array(USERS)

await pool(sessions, CONCURRENCY, async (token, i) => {
  const { data } = await call("/api/user/start-quiz", token, {}, startMetrics)
  papers[i] = data?.quiz?.questions?.map((q) => q.id) || null
})
startMetrics.finish()

// Phase 2 - sustained autosave, the dominant traffic during a drive.
const saveMetrics = new Metrics("save-progress")
const saveJobs = []
for (let round = 0; round < AUTOSAVES_PER_USER; round++) {
  for (let i = 0; i < USERS; i++) saveJobs.push({ i, round })
}

await pool(saveJobs, CONCURRENCY, async ({ i, round }) => {
  const ids = papers[i]
  if (!ids) return
  const responses = ids.slice(0, round + 2).map((id) => ({ questionId: id, selectedOption: 1 }))
  await call("/api/user/save-progress", sessions[i], { responses }, saveMetrics)
})
saveMetrics.finish()

// Phase 3 - the deadline clump, when everyone submits at once.
const submitMetrics = new Metrics("submit-quiz")
await pool(sessions, CONCURRENCY, async (token, i) => {
  const ids = papers[i]
  if (!ids) return
  const responses = ids.map((id) => ({ questionId: id, selectedOption: 0 }))
  await call("/api/user/submit-quiz", token, { responses }, submitMetrics)
})
submitMetrics.finish()

/* ---------------------------------------------------------------- report */

console.log("\n  phase                   requests   thr    p50      p95      p99   status codes")
console.log("  " + "-".repeat(96))
startMetrics.report()
saveMetrics.report()
submitMetrics.report()

const submitted = await User.countDocuments({ hasSubmitted: true })
const started = await User.countDocuments({ hasStarted: true })
const totalRateLimited =
  startMetrics.rateLimited + saveMetrics.rateLimited + submitMetrics.rateLimited

console.log("")
console.log(`  candidates who opened a paper : ${started}/${USERS}`)
console.log(`  candidates who submitted      : ${submitted}/${USERS}`)
console.log(`  requests rejected as 429      : ${totalRateLimited}`)

const complete = submitted === USERS && totalRateLimited === 0

console.log("")
console.log(
  complete
    ? `  PASS - all ${USERS} candidates completed with no rejections\n`
    : `  FAIL - ${USERS - submitted} candidate(s) could not finish` +
        (totalRateLimited ? ` (${totalRateLimited} requests rate limited)` : "") +
        "\n"
)

server.close()
await disconnectDataBase()
await mongo.stop()

process.exit(complete ? 0 : 1)
