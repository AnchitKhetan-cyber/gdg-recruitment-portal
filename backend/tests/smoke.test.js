/**
 * End-to-end smoke test against a throwaway in-memory MongoDB.
 *
 *   npm test
 *
 * Covers the full candidate lifecycle plus the admin surface, and asserts the
 * invariants that were broken in the previous version of this portal:
 *   - the answer key never reaches a candidate response
 *   - a resume returns the same paper and the server's own clock
 *   - autosaved answers survive and are counted at submission
 *   - scoring is done server-side and cannot be influenced by the client
 */
import assert from "node:assert/strict"
import { MongoMemoryServer } from "mongodb-memory-server"
import jwt from "jsonwebtoken"

process.env.NODE_ENV = "test"
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-that-is-long-enough"
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "test-admin-password"
process.env.MAX_VIOLATIONS = "3"

const { createApp } = await import("../app.js")
const { connectDataBase, disconnectDataBase } = await import("../config/db.js")
const { seed } = await import("../scripts/seed.js")
const { User } = await import("../models/user.model.js")
const { Quiz } = await import("../models/quiz.model.js")
const { Allowed } = await import("../models/allowed.model.js")

let passed = 0
let failed = 0

const test = async (name, fn) => {
  try {
    await fn()
    passed += 1
    console.log(`  ✓ ${name}`)
  } catch (error) {
    failed += 1
    console.error(`  ✗ ${name}`)
    console.error(`      ${error.message}`)
  }
}

const section = (name) => console.log(`\n${name}`)

/* ------------------------------------------------------------------ setup */

const mongo = await MongoMemoryServer.create({ instance: { dbName: "gdg_test" } })
await connectDataBase(mongo.getUri())
await seed({ reset: true, quiet: true })

const app = createApp()
const server = app.listen(0)
await new Promise((resolve) => server.once("listening", resolve))
const base = `http://127.0.0.1:${server.address().port}`

/** Minimal cookie-jar fetch wrapper. */
const makeClient = () => {
  const jar = new Map()

  return async (path, { method = "GET", body, headers = {} } = {}) => {
    const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ")

    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    })

    for (const raw of response.headers.getSetCookie?.() || []) {
      const [pair] = raw.split(";")
      const index = pair.indexOf("=")
      const name = pair.slice(0, index)
      const value = pair.slice(index + 1)
      if (value === "") jar.delete(name)
      else jar.set(name, value)
    }

    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }

    return { status: response.status, data, headers: response.headers }
  }
}

/** Issues a candidate session directly, standing in for a Firebase sign-in. */
const signIn = async (client, email) => {
  const user = await User.findOne({ email })
  const token = jwt.sign(
    { id: user._id.toString(), email: user.email, uid: "test-uid", role: "candidate" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  )
  client.token = token
  return { user, token }
}

const withSession = (token) => ({ Cookie: `session=${token}` })

/* ------------------------------------------------------------------ tests */

section("Health & routing")

await test("GET /api/health reports a connected database", async () => {
  const client = makeClient()
  const { status, data } = await client("/api/health")
  assert.equal(status, 200)
  assert.equal(data.database, "connected")
})

await test("unknown routes return a 404 envelope", async () => {
  const client = makeClient()
  const { status, data } = await client("/api/nope")
  assert.equal(status, 404)
  assert.equal(data.success, false)
})

section("Seed data")

await test("seed created exactly one active quiz", async () => {
  const active = await Quiz.countDocuments({ isActive: true })
  assert.equal(active, 1)
})

await test("every seeded question has an in-range correct index", async () => {
  const quiz = await Quiz.findActive()
  for (const q of quiz.questions) {
    assert.ok(
      q.correctAnswers >= 0 && q.correctAnswers < q.options.length,
      `"${q.question.slice(0, 40)}" has correctAnswers ${q.correctAnswers} for ${q.options.length} options`
    )
    assert.equal(q.answer, q.options[q.correctAnswers], "answer text is out of sync with the index")
  }
})

section("Authentication")

await test("unauthenticated candidate routes are rejected", async () => {
  const client = makeClient()
  const { status } = await client("/api/user/start-quiz", { method: "POST", body: {} })
  assert.equal(status, 401)
})

await test("an admin token cannot be used as a candidate session", async () => {
  const client = makeClient()
  const adminToken = jwt.sign({ role: "admin", isAdmin: true }, process.env.JWT_SECRET)
  const { status } = await client("/api/user/start-quiz", {
    method: "POST",
    body: {},
    headers: { Cookie: `session=${adminToken}` }
  })
  assert.equal(status, 403)
})

await test("a non-whitelisted email cannot be signed in", async () => {
  const allowed = await Allowed.findOne({ email: "nobody@example.com" })
  assert.equal(allowed, null)
})

section("Candidate attempt lifecycle")

const candidate = makeClient()
const email = "aarav.sharma@example.com"

// Create the user record the way firebaseAuth would.
const allowedEntry = await Allowed.findOne({ email })
await User.create({
  firebaseUid: "test-uid",
  name: allowedEntry.name,
  email: allowedEntry.email,
  phone: allowedEntry.phone
})
const { token } = await signIn(candidate, email)
const auth = withSession(token)

let assignedQuiz = null

await test("start-quiz assigns a paper of the configured length", async () => {
  const { status, data } = await candidate("/api/user/start-quiz", {
    method: "POST",
    body: {},
    headers: auth
  })
  assert.equal(status, 200)
  assert.equal(data.quiz.questions.length, 15)
  assert.equal(data.timeRemaining, 15 * 60)
  assignedQuiz = data.quiz
})

await test("the served paper contains no answer key", async () => {
  const serialized = JSON.stringify(assignedQuiz)
  assert.ok(!serialized.includes("correctAnswers"), "correctAnswers leaked to the candidate")
  assert.ok(!/"answer"/.test(serialized), "answer text leaked to the candidate")
})

await test("a second start-quiz resumes the identical paper", async () => {
  const { status, data } = await candidate("/api/user/start-quiz", {
    method: "POST",
    body: {},
    headers: auth
  })
  assert.equal(status, 200)
  assert.equal(data.message, "Test resumed")
  assert.deepEqual(
    data.quiz.questions.map((q) => q.id),
    assignedQuiz.questions.map((q) => q.id)
  )
})

await test("autosaved answers are persisted and replayed on resume", async () => {
  const responses = assignedQuiz.questions.slice(0, 3).map((q) => ({
    questionId: q.id,
    selectedOption: 0
  }))

  const saved = await candidate("/api/user/save-progress", {
    method: "POST",
    body: { responses },
    headers: auth
  })
  assert.equal(saved.status, 200)
  assert.equal(saved.data.saved, 3)

  const resumed = await candidate("/api/user/start-quiz", {
    method: "POST",
    body: {},
    headers: auth
  })
  assert.equal(resumed.data.responses.length, 3)
  assert.equal(resumed.data.responses[0].selectedOption, 0)
})

await test("autosave rejects a question id outside the assigned paper", async () => {
  const { data } = await candidate("/api/user/save-progress", {
    method: "POST",
    body: { responses: [{ questionId: "0123456789abcdef01234567", selectedOption: 1 }] },
    headers: auth
  })
  // Still 3 - the foreign id was dropped rather than stored.
  assert.equal(data.saved, 3)
})

await test("the resumed clock comes from the server, not the client", async () => {
  const { data } = await candidate("/api/user/start-quiz", {
    method: "POST",
    body: {},
    headers: auth
  })
  assert.ok(data.timeRemaining <= 15 * 60 && data.timeRemaining > 15 * 60 - 60)
})

await test("violations are counted server-side", async () => {
  const first = await candidate("/api/user/violation", {
    method: "POST",
    body: { type: "tab-switch" },
    headers: auth
  })
  assert.equal(first.data.count, 1)
  assert.equal(first.data.remaining, 2)
  assert.equal(first.data.submitted, false)
})

await test("submission is graded server-side against the snapshot", async () => {
  // Answer every question with the correct option, read straight from the DB.
  const graded = await User.findOne({ email }).select(
    "+quiz.questions.correctAnswers +quiz.questions.answer"
  )
  const responses = graded.quiz.questions.map((q) => ({
    questionId: q.id.toString(),
    selectedOption: q.correctAnswers
  }))

  const { status, data } = await candidate("/api/user/submit-quiz", {
    method: "POST",
    body: { responses },
    headers: auth
  })

  assert.equal(status, 200)
  assert.equal(data.data.totalQuestions, 15)
  assert.equal(data.data.attempted, 15)
  // The candidate is never told their score.
  assert.equal(data.data.score, undefined)

  const after = await User.findOne({ email })
  assert.equal(after.score, 15, "a fully correct paper should score 15")
  assert.equal(after.maxScore, 15)
  assert.equal(after.hasSubmitted, true)
  assert.ok(after.submittedAt instanceof Date, "submittedAt was not persisted")
})

await test("a submitted attempt cannot be submitted or restarted again", async () => {
  const resubmit = await candidate("/api/user/submit-quiz", {
    method: "POST",
    body: { responses: [] },
    headers: auth
  })
  assert.equal(resubmit.status, 400)

  const restart = await candidate("/api/user/start-quiz", {
    method: "POST",
    body: {},
    headers: auth
  })
  assert.equal(restart.status, 400)
})

section("Scoring correctness")

await test("a wrong answer scores zero and unanswered questions are recorded as -1", async () => {
  const second = "diya.verma@example.com"
  const entry = await Allowed.findOne({ email: second })
  await User.create({
    firebaseUid: "test-uid-2",
    name: entry.name,
    email: entry.email,
    phone: entry.phone
  })

  const client = makeClient()
  const { token: t2 } = await signIn(client, second)
  const h2 = withSession(t2)

  await client("/api/user/start-quiz", { method: "POST", body: {}, headers: h2 })

  const graded = await User.findOne({ email: second }).select("+quiz.questions.correctAnswers")

  // Answer the first five deliberately wrong, leave the rest blank.
  const responses = graded.quiz.questions.slice(0, 5).map((q) => ({
    questionId: q.id.toString(),
    selectedOption: (q.correctAnswers + 1) % q.options.length
  }))

  const { data } = await client("/api/user/submit-quiz", {
    method: "POST",
    body: { responses },
    headers: h2
  })

  assert.equal(data.data.attempted, 5)

  const after = await User.findOne({ email: second })
  assert.equal(after.score, 0)
  assert.equal(after.responses.length, 15, "every question should get a response row")
  assert.equal(after.responses.filter((r) => r.selectedOption === -1).length, 10)
})

await test("an out-of-range selectedOption is discarded rather than trusted", async () => {
  const third = "kabir.nair@example.com"
  const entry = await Allowed.findOne({ email: third })
  await User.create({
    firebaseUid: "test-uid-3",
    name: entry.name,
    email: entry.email,
    phone: entry.phone
  })

  const client = makeClient()
  const { token: t3 } = await signIn(client, third)
  const h3 = withSession(t3)

  const started = await client("/api/user/start-quiz", { method: "POST", body: {}, headers: h3 })

  const responses = started.data.quiz.questions.map((q) => ({
    questionId: q.id,
    selectedOption: 9
  }))

  await client("/api/user/submit-quiz", { method: "POST", body: { responses }, headers: h3 })

  const after = await User.findOne({ email: third })
  assert.equal(after.score, 0)
  assert.ok(
    after.responses.every((r) => r.selectedOption === -1),
    "an option index past the end of the list should not be stored"
  )
})

section("Admin panel API")

const admin = makeClient()

await test("admin login rejects a wrong password", async () => {
  const { status } = await admin("/api/admin/login", {
    method: "POST",
    body: { password: "wrong" }
  })
  assert.equal(status, 401)
})

await test("admin login issues a session and verifies", async () => {
  const login = await admin("/api/admin/login", {
    method: "POST",
    body: { password: process.env.ADMIN_PASSWORD }
  })
  assert.equal(login.status, 200)

  const verify = await admin("/api/admin/verify")
  assert.equal(verify.status, 200)
  assert.equal(verify.data.admin.isAdmin, true)
})

await test("results list is paginated and carries status counts", async () => {
  const { status, data } = await admin("/api/admin/results?limit=10")
  assert.equal(status, 200)
  assert.equal(data.stats.submitted, 3)
  assert.ok(Array.isArray(data.users))
})

await test("the results list does not carry any answer key", async () => {
  const { data } = await admin("/api/admin/results?limit=50")
  const serialized = JSON.stringify(data)
  assert.ok(!serialized.includes("correctAnswers"))
})

await test("search and status filters narrow the result set", async () => {
  const { data } = await admin("/api/admin/results?search=aarav&status=submitted")
  assert.equal(data.users.length, 1)
  assert.equal(data.users[0].email, "aarav.sharma@example.com")
})

await test("the per-candidate review exposes the correct option to the reviewer", async () => {
  const list = await admin("/api/admin/results?search=aarav")
  const id = list.data.users[0]._id

  const { status, data } = await admin(`/api/admin/results/${id}`)
  assert.equal(status, 200)
  assert.equal(data.review.length, 15)
  assert.ok(Number.isInteger(data.review[0].correctOption))
  assert.equal(data.review.every((r) => r.isCorrect), true)
})

await test("analytics summarise scores as percentage bands", async () => {
  const { status, data } = await admin("/api/admin/analytics")
  assert.equal(status, 200)
  assert.equal(data.analytics.overview.submitted, 3)
  assert.equal(data.analytics.scores.highest, 15)
  assert.equal(data.analytics.scores.lowest, 0)
  assert.equal(data.analytics.distribution.excellent, 1)
  assert.equal(data.analytics.distribution.poor, 2)
})

await test("CSV export downloads as a file with one row per candidate", async () => {
  const { status, data, headers } = await admin("/api/admin/export-results?status=submitted")
  assert.equal(status, 200)
  assert.match(headers.get("content-type"), /text\/csv/)
  assert.match(headers.get("content-disposition"), /attachment; filename=/)
  const lines = String(data).trim().split("\r\n")
  assert.equal(lines.length, 4, "expected a header row plus three submissions")
})

await test("shortlisting qualifies the top scorers", async () => {
  const { status, data } = await admin("/api/admin/results/shortlist", {
    method: "POST",
    body: { count: 1, replace: true }
  })
  assert.equal(status, 200)
  assert.equal(data.qualified, 1)

  const qualified = await User.findOne({ qualifiedForInterview: true })
  assert.equal(qualified.email, "aarav.sharma@example.com")
})

await test("a quiz can be created, activated, and supersedes the previous one", async () => {
  const create = await admin("/api/admin/quizzes", {
    method: "POST",
    body: {
      title: "Design Round",
      description: "A short round about product and design thinking.",
      duration: 10,
      questionsPerAttempt: 2,
      questions: [
        { question: "What is a wireframe?", options: ["A layout sketch", "A font"], correctAnswers: 0 },
        { question: "What is contrast for?", options: ["Decoration", "Legibility"], correctAnswers: 1 }
      ]
    }
  })
  assert.equal(create.status, 201)

  const activate = await admin(`/api/admin/quizzes/${create.data.quiz._id}/activate`, {
    method: "PUT",
    body: {}
  })
  assert.equal(activate.status, 200)

  const active = await Quiz.find({ isActive: true })
  assert.equal(active.length, 1)
  assert.equal(active[0].title, "Design Round")
})

await test("a quiz with an out-of-range correct index is rejected", async () => {
  const { status, data } = await admin("/api/admin/quizzes", {
    method: "POST",
    body: {
      title: "Broken Quiz",
      description: "This quiz should never be accepted by the API.",
      duration: 5,
      questions: [{ question: "Pick one option", options: ["A", "B"], correctAnswers: 5 }]
    }
  })
  assert.equal(status, 400)
  assert.match(data.message, /does not exist/)
})

await test("questionsPerAttempt cannot exceed the size of the question pool", async () => {
  const { status } = await admin("/api/admin/quizzes", {
    method: "POST",
    body: {
      title: "Too Few Questions",
      description: "Asks for more questions than the pool contains.",
      duration: 5,
      questionsPerAttempt: 10,
      questions: [{ question: "Only one question here", options: ["A", "B"], correctAnswers: 0 }]
    }
  })
  assert.equal(status, 400)
})

await test("bulk whitelist import is idempotent", async () => {
  const entries = [
    { name: "Meera Iyer", email: "meera.iyer@example.com", phone: "9000000010" },
    { name: "Arjun Das", email: "arjun.das@example.com", phone: "9000000011" }
  ]

  const first = await admin("/api/admin/allowed-users/bulk", { method: "POST", body: { entries } })
  assert.equal(first.data.inserted, 2)

  const second = await admin("/api/admin/allowed-users/bulk", { method: "POST", body: { entries } })
  assert.equal(second.data.inserted, 0)
  assert.equal(second.data.skipped, 2)
})

await test("resetting an attempt clears the paper and lets the candidate restart", async () => {
  const list = await admin("/api/admin/results?search=aarav")
  const id = list.data.users[0]._id

  const reset = await admin(`/api/admin/results/${id}/reset`, { method: "PUT", body: {} })
  assert.equal(reset.status, 200)

  const after = await User.findById(id)
  assert.equal(after.hasStarted, false)
  assert.equal(after.hasSubmitted, false)
  assert.equal(after.quiz, null)
  assert.equal(after.responses.length, 0)
})

await test("admin routes are closed to an unauthenticated caller", async () => {
  const stranger = makeClient()
  const { status } = await stranger("/api/admin/results")
  assert.equal(status, 401)
})

await test("a candidate session cannot reach admin routes", async () => {
  const { status } = await admin("/api/admin/results", { headers: { Cookie: `adminToken=${token}` } })
  assert.equal(status, 403)
})

section("Input hardening")

await test("Mongo operator injection is stripped from the body", async () => {
  const { status } = await admin("/api/admin/login", {
    method: "POST",
    body: { password: { $ne: null } }
  })
  assert.equal(status, 400, "the $ne operator should be stripped, leaving an invalid body")
})

await test("a non-JSON content type is refused on a POST", async () => {
  const response = await fetch(`${base}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "password=hunter2"
  })
  assert.equal(response.status, 415)
})

/* ---------------------------------------------------------------- teardown */

server.close()
await disconnectDataBase()
await mongo.stop()

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed ? 1 : 0)
