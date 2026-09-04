import bcrypt from "bcryptjs"
import crypto from "node:crypto"
import { z } from "zod"
import { env } from "../config/env.js"
import { Allowed, EMAIL_REGEX, PHONE_REGEX } from "../models/allowed.model.js"
import { Quiz } from "../models/quiz.model.js"
import { ENFORCED_VIOLATIONS, User } from "../models/user.model.js"
import { ADMIN_COOKIE, cookieOptions, generateAdminToken } from "../middlewares/auth.middleware.js"
import { ApiError } from "../utils/apiError.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { created, ok } from "../utils/response.js"
import { parseOrThrow } from "../utils/validate.js"
import { toCsv } from "../utils/csv.js"

const ADMIN_TTL_MS = 24 * 60 * 60 * 1000

/* ------------------------------------------------------------------ auth -- */

const loginSchema = z.object({ password: z.string().min(1, "Password is required") })

/** Constant-time comparison so a wrong password cannot be found by timing. */
const safeEqual = (a, b) => {
  const bufA = Buffer.from(String(a))
  const bufB = Buffer.from(String(b))
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

export const adminLogin = asyncHandler(async (req, res) => {
  const { password } = parseOrThrow(loginSchema, req.body)

  if (!env.adminPassword && !env.adminPasswordHash) {
    throw ApiError.forbidden("Password login is disabled. Sign in with Google.")
  }

  const valid = env.adminPasswordHash
    ? await bcrypt.compare(password, env.adminPasswordHash)
    : safeEqual(password, env.adminPassword)

  if (!valid) throw ApiError.unauthorized("Invalid admin password")

  res.cookie(ADMIN_COOKIE, generateAdminToken(), cookieOptions(ADMIN_TTL_MS))
  return ok(res, {}, "Admin login successful")
})

/**
 * POST /api/admin/google-login
 *
 * The Firebase ID token is verified by firebaseAuthMiddleware, so req.firebaseUser
 * is trustworthy here. Admission is by an explicit email allowlist (ADMIN_EMAILS)
 * - never a whole domain - and the verified email is stamped into the admin
 * token so actions can be attributed.
 */
export const adminGoogleLogin = asyncHandler(async (req, res) => {
  const { email, emailVerified } = req.firebaseUser

  if (!email || !emailVerified) {
    throw ApiError.forbidden("Your Google email is not verified.")
  }

  if (!env.adminEmails.length) {
    throw ApiError.forbidden("Google sign-in for admins is not configured.")
  }

  const normalized = email.toLowerCase().trim()
  if (!env.adminEmails.includes(normalized)) {
    throw ApiError.forbidden("This Google account is not an authorised admin.")
  }

  res.cookie(ADMIN_COOKIE, generateAdminToken(normalized), cookieOptions(ADMIN_TTL_MS))
  return ok(res, { admin: { email: normalized } }, "Admin signed in with Google")
})

export const adminLogout = asyncHandler(async (_req, res) => {
  res.clearCookie(ADMIN_COOKIE, cookieOptions(0))
  return ok(res, {}, "Admin logged out successfully")
})

export const verifyAdmin = asyncHandler(async (req, res) => ok(res, { admin: req.admin }, "Admin verified"))

/* ----------------------------------------------------------------- quizzes */

const questionSchema = z.object({
  question: z.string().min(5, "Question must be at least 5 characters long"),
  options: z.array(z.string().min(1, "Options cannot be empty")).min(2).max(6),
  correctAnswers: z.number().int().min(0),
  image: z.string().url().or(z.literal("")).optional(),
  marks: z.number().min(0).max(100).optional()
})

const quizSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  duration: z.number().int().min(1).max(600),
  questionsPerAttempt: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
  questions: z.array(questionSchema).min(1, "At least one question is required")
})

/** Rejects a question whose correct index does not point at a real option. */
const assertAnswerIndexes = (questions) => {
  questions.forEach((q, i) => {
    if (q.correctAnswers >= q.options.length) {
      throw ApiError.badRequest(
        `Question ${i + 1}: correct option #${q.correctAnswers + 1} does not exist (only ${q.options.length} options)`
      )
    }
  })
}

export const getAllQuizzes = asyncHandler(async (_req, res) => {
  const quizzes = await Quiz.find()
    .select("title description duration questionsPerAttempt isActive questions createdAt updatedAt")
    .sort({ isActive: -1, createdAt: -1 })
    .lean()

  const summaries = quizzes.map(({ questions, ...rest }) => ({
    ...rest,
    questionCount: questions?.length || 0
  }))

  return ok(res, { count: summaries.length, quizzes: summaries }, "Quizzes retrieved")
})

export const getQuizById = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id)
  if (!quiz) throw ApiError.notFound("Quiz not found")
  return ok(res, { quiz }, "Quiz retrieved")
})

export const createQuiz = asyncHandler(async (req, res) => {
  const payload = parseOrThrow(quizSchema, req.body)
  assertAnswerIndexes(payload.questions)

  if (payload.questionsPerAttempt > payload.questions.length) {
    throw ApiError.badRequest(
      `questionsPerAttempt (${payload.questionsPerAttempt}) exceeds the ${payload.questions.length} questions in the pool`
    )
  }

  const quiz = await Quiz.create(payload)
  if (payload.isActive) await Quiz.activateOnly(quiz._id)

  return created(res, { quiz }, "Quiz created")
})

export const updateQuiz = asyncHandler(async (req, res) => {
  const payload = parseOrThrow(quizSchema.partial(), req.body)

  const quiz = await Quiz.findById(req.params.id)
  if (!quiz) throw ApiError.notFound("Quiz not found")

  if (payload.questions) assertAnswerIndexes(payload.questions)

  // Standing the live test down here would leave the drive with no active
  // quiz and every candidate unable to start. Promoting a different one is
  // the only safe way to change which test is live.
  if (payload.isActive === false && quiz.isActive) {
    throw ApiError.badRequest(
      "Cannot deactivate the live test. Activate a different test instead, which stands this one down."
    )
  }

  Object.assign(quiz, payload)

  const poolSize = quiz.questions.length
  if (quiz.questionsPerAttempt > poolSize) {
    throw ApiError.badRequest(
      `questionsPerAttempt (${quiz.questionsPerAttempt}) exceeds the ${poolSize} questions in the pool`
    )
  }

  await quiz.save()
  if (payload.isActive) await Quiz.activateOnly(quiz._id)

  return ok(res, { quiz }, "Quiz updated")
})

/** Makes one quiz the live paper and stands every other one down. */
export const activateQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id)
  if (!quiz) throw ApiError.notFound("Quiz not found")

  const updated = await Quiz.activateOnly(quiz._id)
  return ok(res, { quiz: updated }, `"${updated.title}" is now the active test`)
})

export const deleteQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id)
  if (!quiz) throw ApiError.notFound("Quiz not found")

  if (quiz.isActive) {
    const inFlight = await User.countDocuments({ hasStarted: true, hasSubmitted: false })
    if (inFlight > 0) {
      throw ApiError.conflict(
        `Cannot delete the active test while ${inFlight} candidate(s) are still writing it`
      )
    }
  }

  await quiz.deleteOne()
  return ok(res, { id: req.params.id }, "Quiz deleted")
})

/* ----------------------------------------------------------- allowed users */

const allowedSchema = z.object({
  email: z.string().regex(EMAIL_REGEX, "Invalid email address").max(254),
  name: z.string().min(2).max(50),
  phone: z.string().regex(PHONE_REGEX, "Phone must be 10 digits"),
  tag: z.string().max(40).optional()
})

const bulkAllowedSchema = z.object({
  entries: z.array(allowedSchema).min(1).max(2000)
})

export const getAllowedUsers = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
  const limit = Math.min(500, Math.max(1, Number.parseInt(req.query.limit, 10) || 50))
  // String() rather than a bare .trim(): normalizeQuery collapses duplicated
  // parameters, but coercing here means a controller can never be one odd
  // query string away from a 500.
  const search = String(req.query.search || "").trim()

  const query = search
    ? {
        $or: [
          { name: { $regex: escapeRegex(search), $options: "i" } },
          { email: { $regex: escapeRegex(search), $options: "i" } },
          { phone: { $regex: escapeRegex(search), $options: "i" } }
        ]
      }
    : {}

  const [entries, total] = await Promise.all([
    Allowed.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Allowed.countDocuments(query)
  ])

  return ok(
    res,
    { entries, total, page, totalPages: Math.ceil(total / limit) || 1 },
    "Allowed users retrieved"
  )
})

export const getAllowedUserById = asyncHandler(async (req, res) => {
  const entry = await Allowed.findById(req.params.id)
  if (!entry) throw ApiError.notFound("Allowed user not found")
  return ok(res, { entry }, "Allowed user retrieved")
})

export const addAllowedUser = asyncHandler(async (req, res) => {
  const payload = parseOrThrow(allowedSchema, req.body)
  const entry = await Allowed.create(payload)
  return created(res, { entry }, "Candidate whitelisted")
})

/**
 * Bulk import, used by the admin panel's CSV upload. Duplicates are skipped
 * rather than failing the whole batch, so a re-upload is safe.
 */
export const bulkAddAllowedUsers = asyncHandler(async (req, res) => {
  const { entries } = parseOrThrow(bulkAllowedSchema, req.body)

  const operations = entries.map((entry) => ({
    updateOne: {
      filter: { email: entry.email.toLowerCase().trim() },
      update: { $setOnInsert: { ...entry, email: entry.email.toLowerCase().trim() } },
      upsert: true
    }
  }))

  const result = await Allowed.bulkWrite(operations, { ordered: false })

  return ok(
    res,
    {
      received: entries.length,
      inserted: result.upsertedCount || 0,
      skipped: entries.length - (result.upsertedCount || 0)
    },
    "Bulk import complete"
  )
})

export const updateAllowedUser = asyncHandler(async (req, res) => {
  const payload = parseOrThrow(allowedSchema.partial(), req.body)

  const entry = await Allowed.findByIdAndUpdate(req.params.id, payload, {
    new: true,
    runValidators: true
  })

  if (!entry) throw ApiError.notFound("Allowed user not found")
  return ok(res, { entry }, "Allowed user updated")
})

export const deleteAllowedUser = asyncHandler(async (req, res) => {
  const entry = await Allowed.findByIdAndDelete(req.params.id)
  if (!entry) throw ApiError.notFound("Allowed user not found")
  return ok(res, { id: req.params.id }, "Allowed user removed")
})

/* ----------------------------------------------------------------- results */

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const SORTABLE = new Set(["createdAt", "updatedAt", "score", "timeUsed", "name", "email", "submittedAt"])

const buildResultsQuery = ({ search, status, qualified }) => {
  const query = {}

  if (status === "submitted") query.hasSubmitted = true
  else if (status === "in-progress") Object.assign(query, { hasStarted: true, hasSubmitted: false })
  else if (status === "not-started") query.hasStarted = false

  if (qualified === "yes") query.qualifiedForInterview = true
  else if (qualified === "no") query.qualifiedForInterview = false

  if (search) {
    const pattern = escapeRegex(search)
    query.$or = [
      { name: { $regex: pattern, $options: "i" } },
      { email: { $regex: pattern, $options: "i" } }
    ]
  }

  return query
}

export const getAllResults = asyncHandler(async (req, res) => {
  const {
    page: rawPage = 1,
    limit: rawLimit = 25,
    search = "",
    status = "all",
    qualified = "all",
    sortBy = "createdAt",
    order = "desc"
  } = req.query

  const page = Math.max(1, Number.parseInt(rawPage, 10) || 1)
  const limit = Math.min(200, Math.max(1, Number.parseInt(rawLimit, 10) || 25))
  const sortField = SORTABLE.has(sortBy) ? sortBy : "createdAt"

  const query = buildResultsQuery({ search: String(search).trim(), status, qualified })

  const [users, total, stats] = await Promise.all([
    User.find(query)
      .select(
        "name email phone hasStarted hasSubmitted score maxScore qualifiedForInterview timeUsed violations autoSubmitted autoSubmitReason startedAt submittedAt createdAt"
      )
      .sort({ [sortField]: order === "asc" ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(query),
    getStatusCounts()
  ])

  const rows = users.map(({ violations = [], ...rest }) => ({
    ...rest,
    // Split, so a reviewer can tell a deliberate tab switch from a camera guess.
    violationCount: violations.filter((v) => ENFORCED_VIOLATIONS.includes(v.type)).length,
    flagCount: violations.filter((v) => !ENFORCED_VIOLATIONS.includes(v.type)).length
  }))

  return ok(
    res,
    {
      count: rows.length,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      stats,
      users: rows
    },
    "Results retrieved"
  )
})

const getStatusCounts = async () => {
  const [total, submitted, inProgress, notStarted, qualified] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ hasSubmitted: true }),
    User.countDocuments({ hasStarted: true, hasSubmitted: false }),
    User.countDocuments({ hasStarted: false }),
    User.countDocuments({ qualifiedForInterview: true })
  ])
  return { total, submitted, inProgress, notStarted, qualified }
}

/**
 * Full attempt detail for one candidate, including a per-question review.
 *
 * The answer key is loaded explicitly here because the reviewer needs to see
 * which option was right - it is never attached to any candidate-facing route.
 */
export const getResultById = asyncHandler(async (req, res) => {
  const user = await User.findByIdWithAnswerKey(req.params.id)
  if (!user) throw ApiError.notFound("Candidate not found")

  const answers = new Map(user.responses.map((r) => [r.questionId.toString(), r]))

  const review = (user.quiz?.questions || []).map((question, index) => {
    const response = answers.get(question.id.toString())
    return {
      number: index + 1,
      questionId: question.id.toString(),
      question: question.question,
      options: question.options,
      image: question.image || null,
      marks: question.marks ?? 1,
      correctOption: question.correctAnswers,
      selectedOption: response?.selectedOption ?? -1,
      isCorrect: Boolean(response?.isCorrect)
    }
  })

  return ok(
    res,
    {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        hasStarted: user.hasStarted,
        hasSubmitted: user.hasSubmitted,
        score: user.score,
        maxScore: user.maxScore,
        timeUsed: user.timeUsed,
        startedAt: user.startedAt,
        submittedAt: user.submittedAt,
        qualifiedForInterview: user.qualifiedForInterview,
        adminNotes: user.adminNotes,
        autoSubmitted: user.autoSubmitted,
        autoSubmitReason: user.autoSubmitReason,
        violations: user.violations,
        quizTitle: user.quiz?.title || null
      },
      review
    },
    "Candidate result retrieved"
  )
})

export const getAnalytics = asyncHandler(async (_req, res) => {
  const overview = await getStatusCounts()

  const submitted = await User.find({ hasSubmitted: true })
    .select("score maxScore timeUsed violations")
    .lean()

  const scores = submitted.map((u) => u.score).sort((a, b) => a - b)
  const times = submitted.map((u) => u.timeUsed).sort((a, b) => a - b)
  const maxScore = submitted[0]?.maxScore || 0

  const median = (sorted) => {
    if (!sorted.length) return 0
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
      ? Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2))
      : sorted[mid]
  }

  const mean = (values) =>
    values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)) : 0

  // Percentage bands, so the buckets stay meaningful when the paper length changes.
  const distribution = { excellent: 0, good: 0, average: 0, poor: 0 }
  for (const attempt of submitted) {
    const pct = attempt.maxScore ? (attempt.score / attempt.maxScore) * 100 : 0
    if (pct >= 80) distribution.excellent += 1
    else if (pct >= 60) distribution.good += 1
    else if (pct >= 40) distribution.average += 1
    else distribution.poor += 1
  }

  // Histogram across the score range, for the dashboard chart.
  const histogram = Array.from({ length: maxScore + 1 }, (_, i) => ({ score: i, count: 0 }))
  for (const score of scores) {
    if (histogram[score]) histogram[score].count += 1
  }

  const flagged = await User.countDocuments({ autoSubmitted: true })

  return ok(
    res,
    {
      analytics: {
        overview: {
          ...overview,
          completionRate: overview.total ? Number(((overview.submitted / overview.total) * 100).toFixed(1)) : 0
        },
        scores: {
          average: mean(scores),
          median: median(scores),
          highest: scores.length ? scores[scores.length - 1] : 0,
          lowest: scores.length ? scores[0] : 0,
          maxScore
        },
        time: {
          averageSeconds: mean(times),
          fastestSeconds: times.length ? times[0] : 0,
          slowestSeconds: times.length ? times[times.length - 1] : 0
        },
        distribution,
        histogram,
        integrity: { autoSubmitted: flagged }
      }
    },
    "Analytics retrieved"
  )
})

/** Streams a CSV download of the current result set. */
export const exportResults = asyncHandler(async (req, res) => {
  const { status = "all", qualified = "all", search = "" } = req.query
  const query = buildResultsQuery({ search: String(search).trim(), status, qualified })

  const users = await User.find(query)
    .select(
      "name email phone score maxScore hasStarted hasSubmitted qualifiedForInterview timeUsed violations autoSubmitReason submittedAt createdAt"
    )
    .sort({ score: -1, timeUsed: 1 })
    .lean()

  const headers = [
    "Name",
    "Email",
    "Phone",
    "Status",
    "Score",
    "Max Score",
    "Percentage",
    "Time Used (mm:ss)",
    "Violations",
    "Review Flags",
    "Auto Submitted",
    "Qualified",
    "Submitted At"
  ]

  const rows = users.map((user) => {
    const status = user.hasSubmitted ? "Submitted" : user.hasStarted ? "In Progress" : "Not Started"
    const pct = user.hasSubmitted && user.maxScore ? ((user.score / user.maxScore) * 100).toFixed(1) : ""
    const mm = String(Math.floor((user.timeUsed || 0) / 60)).padStart(2, "0")
    const ss = String((user.timeUsed || 0) % 60).padStart(2, "0")

    return [
      user.name,
      user.email,
      user.phone || "",
      status,
      user.hasSubmitted ? user.score : "",
      user.hasSubmitted ? user.maxScore : "",
      pct,
      user.hasSubmitted ? `${mm}:${ss}` : "",
      (user.violations || []).filter((v) => ENFORCED_VIOLATIONS.includes(v.type)).length,
      (user.violations || []).filter((v) => !ENFORCED_VIOLATIONS.includes(v.type)).length,
      user.autoSubmitReason || "",
      user.qualifiedForInterview ? "Yes" : "No",
      user.submittedAt ? new Date(user.submittedAt).toISOString() : ""
    ]
  })

  const csv = toCsv(headers, rows)
  const filename = `gdg-results-${new Date().toISOString().slice(0, 10)}.csv`

  res.setHeader("Content-Type", "text/csv; charset=utf-8")
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
  return res.status(200).send(csv)
})

const qualificationSchema = z.object({
  qualifiedForInterview: z.boolean(),
  adminNotes: z.string().max(2000).optional()
})

export const updateQualificationStatus = asyncHandler(async (req, res) => {
  const payload = parseOrThrow(qualificationSchema, req.body)

  const user = await User.findByIdAndUpdate(req.params.id, payload, { new: true }).select(
    "name email qualifiedForInterview adminNotes"
  )

  if (!user) throw ApiError.notFound("Candidate not found")
  return ok(res, { user }, "Qualification status updated")
})

/**
 * Bulk-qualifies the top N submissions, ranked by score then by time taken.
 * Saves the panel from ticking a hundred checkboxes by hand.
 */
const shortlistSchema = z.object({
  count: z.number().int().min(1).max(1000).optional(),
  minScore: z.number().int().min(0).optional(),
  replace: z.boolean().optional()
})

export const shortlistCandidates = asyncHandler(async (req, res) => {
  const { count, minScore, replace = false } = parseOrThrow(shortlistSchema, req.body)

  if (count === undefined && minScore === undefined) {
    throw ApiError.badRequest("Provide either a count or a minimum score")
  }

  if (replace) {
    await User.updateMany({}, { $set: { qualifiedForInterview: false } })
  }

  const query = { hasSubmitted: true }
  if (minScore !== undefined) query.score = { $gte: minScore }

  let selection = User.find(query).select("_id").sort({ score: -1, timeUsed: 1 })
  if (count !== undefined) selection = selection.limit(count)

  const ids = (await selection.lean()).map((u) => u._id)

  await User.updateMany({ _id: { $in: ids } }, { $set: { qualifiedForInterview: true } })

  return ok(res, { qualified: ids.length }, `${ids.length} candidate(s) shortlisted`)
})

/** Clears an attempt so a candidate can retake after a genuine technical failure. */
export const resetUserAttempt = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        hasStarted: false,
        hasSubmitted: false,
        startedAt: null,
        submittedAt: null,
        timeUsed: 0,
        score: 0,
        maxScore: 0,
        responses: [],
        violations: [],
        autoSubmitted: false,
        autoSubmitReason: null,
        quiz: null
      }
    },
    { new: true }
  ).select("name email hasStarted hasSubmitted")

  if (!user) throw ApiError.notFound("Candidate not found")
  return ok(res, { user }, `Attempt reset for ${user.email}`)
})

export const deleteUserResult = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id)
  if (!user) throw ApiError.notFound("Candidate not found")
  return ok(res, { id: req.params.id }, "Candidate record deleted")
})
