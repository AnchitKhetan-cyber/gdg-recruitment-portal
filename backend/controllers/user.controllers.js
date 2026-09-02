import { z } from "zod"
import { Allowed } from "../models/allowed.model.js"
import { Quiz } from "../models/quiz.model.js"
import { User } from "../models/user.model.js"
import {
  SESSION_COOKIE,
  cookieOptions,
  generateToken
} from "../middlewares/auth.middleware.js"
import { env } from "../config/env.js"
import { ApiError } from "../utils/apiError.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { ok } from "../utils/response.js"
import { parseOrThrow } from "../utils/validate.js"
import { buildAnswerKey, gradeAttempt, mergeProgress } from "../utils/scoring.js"

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
// Allowance for network latency between the client clock running out and the
// submission landing, so an honest last-second submit is not rejected.
const SUBMIT_GRACE_SECONDS = 15

const objectIdString = z.string().regex(/^[a-f\d]{24}$/i, "Invalid question id")

const responseArraySchema = z.array(
  z.object({
    questionId: objectIdString,
    selectedOption: z.number().int().min(-1).max(10).optional()
  })
)

const submitSchema = z.object({
  responses: responseArraySchema
})

const progressSchema = z.object({
  responses: responseArraySchema
})

const violationSchema = z.object({
  type: z.enum(["tab-switch", "window-blur", "fullscreen-exit", "copy", "paste", "devtools"])
})

/** Shape returned to the portal for the signed-in candidate. */
const publicUser = (user) => ({
  uid: user.firebaseUid,
  name: user.name,
  email: user.email,
  hasStarted: user.hasStarted,
  hasSubmitted: user.hasSubmitted,
  isResuming: user.hasStarted && !user.hasSubmitted
})

/**
 * POST /api/user/firebase-auth
 * Exchanges a verified Google identity for a candidate session cookie.
 */
export const firebaseAuth = asyncHandler(async (req, res) => {
  const { uid, email, name } = req.firebaseUser

  if (!email || !uid) {
    throw ApiError.badRequest("Google account did not provide an email address")
  }

  const normalizedEmail = email.toLowerCase().trim()

  const allowed = await Allowed.findOne({ email: normalizedEmail }).lean()
  if (!allowed) {
    throw ApiError.forbidden(
      "This email is not on the shortlist. Use the address you registered with."
    )
  }

  let user = await User.findOne({
    $or: [{ firebaseUid: uid }, { email: normalizedEmail }]
  })

  if (user) {
    let dirty = false
    if (!user.firebaseUid) {
      user.firebaseUid = uid
      dirty = true
    }
    if (!user.phone && allowed.phone) {
      user.phone = allowed.phone
      dirty = true
    }
    if (dirty) await user.save()
  } else {
    user = await User.create({
      firebaseUid: uid,
      name: allowed.name || name || normalizedEmail.split("@")[0],
      email: normalizedEmail,
      phone: allowed.phone || undefined
    })
  }

  res.cookie(SESSION_COOKIE, generateToken(user), cookieOptions(SESSION_TTL_MS))

  return ok(res, { user: publicUser(user) }, "Signed in successfully")
})

/** GET /api/user/verify - cheap session probe used by the route guard. */
export const verifyAuth = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.user.id, email: req.user.email }).select(
    "name email firebaseUid hasStarted hasSubmitted"
  )

  if (!user) throw ApiError.unauthorized("Session no longer valid")

  return ok(res, { user: publicUser(user) }, "Session valid")
})

/** GET /api/user/logout */
export const logout = asyncHandler(async (_req, res) => {
  res.clearCookie(SESSION_COOKIE, cookieOptions(0))
  return ok(res, {}, "Logged out successfully")
})

/** Draws a random subset of the active quiz's question pool. */
const drawQuestions = (quiz) => {
  const pool = [...quiz.questions]

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }

  const take = Math.min(quiz.questionsPerAttempt || pool.length, pool.length)

  return pool.slice(0, take).map((q) => ({
    id: q._id,
    question: q.question,
    options: q.options,
    image: q.image || "",
    marks: q.marks ?? 1,
    correctAnswers: q.correctAnswers,
    answer: q.answer
  }))
}

/**
 * POST /api/user/start-quiz
 *
 * Assigns a snapshot on first call and replays the same snapshot on every later
 * call, so a refresh resumes the identical paper with the identical clock.
 */
export const startQuiz = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.user.id, email: req.user.email })
  if (!user) throw ApiError.notFound("User not found")

  if (user.hasSubmitted) {
    throw ApiError.badRequest("You have already submitted this test")
  }

  // Resume path.
  if (user.hasStarted && user.quiz?.questions?.length) {
    const timeRemaining = user.getTimeRemaining()

    if (timeRemaining <= 0) {
      await finalizeAttempt(user, { autoReason: "time-expired" })
      throw ApiError.badRequest("Your time expired and the test was submitted automatically")
    }

    return ok(
      res,
      {
        quiz: user.getPublicQuiz(),
        responses: user.responses.map((r) => ({
          questionId: r.questionId.toString(),
          selectedOption: r.selectedOption
        })),
        timeRemaining,
        timeUsed: user.getElapsedSeconds(),
        violations: user.violations.length,
        maxViolations: env.maxViolations
      },
      "Test resumed"
    )
  }

  const quiz = await Quiz.findActive()
  if (!quiz) throw ApiError.notFound("No test is currently active. Please contact the organisers.")

  const questions = drawQuestions(quiz)
  if (!questions.length) throw ApiError.notFound("The active test has no questions")

  user.quiz = {
    quizId: quiz._id,
    title: quiz.title,
    description: quiz.description,
    duration: quiz.duration,
    questions
  }
  user.hasStarted = true
  user.startedAt = new Date()
  user.responses = []
  user.violations = []
  user.timeUsed = 0

  await user.save()

  return ok(
    res,
    {
      quiz: user.getPublicQuiz(),
      responses: [],
      timeRemaining: quiz.duration * 60,
      timeUsed: 0,
      violations: 0,
      maxViolations: env.maxViolations
    },
    "Test started"
  )
})

/**
 * POST /api/user/save-progress
 *
 * Periodic autosave. Persisting answers and elapsed time server-side is what
 * makes a mid-test crash recoverable.
 */
export const saveProgress = asyncHandler(async (req, res) => {
  const { responses } = parseOrThrow(progressSchema, req.body)

  const user = await User.findOne({ _id: req.user.id, email: req.user.email })
  if (!user) throw ApiError.notFound("User not found")
  if (!user.hasStarted || !user.quiz) throw ApiError.badRequest("Test has not been started")
  if (user.hasSubmitted) throw ApiError.badRequest("Test already submitted")

  const validIds = new Set(user.quiz.questions.map((q) => q.id.toString()))

  user.responses = mergeProgress(user.responses, responses, validIds)
  user.timeUsed = user.getElapsedSeconds()

  const timeRemaining = user.getTimeRemaining()

  if (timeRemaining <= 0) {
    const result = await finalizeAttempt(user, { autoReason: "time-expired" })
    return ok(res, { submitted: true, ...result }, "Time expired - your test was submitted")
  }

  await user.save()

  return ok(res, { submitted: false, timeRemaining, saved: user.responses.length }, "Progress saved")
})

/**
 * POST /api/user/violation
 *
 * Records a proctoring event. The threshold is enforced here rather than in the
 * browser, where the old localStorage counter could simply be edited away.
 */
export const recordViolation = asyncHandler(async (req, res) => {
  const { type } = parseOrThrow(violationSchema, req.body)

  const user = await User.findOne({ _id: req.user.id, email: req.user.email })
  if (!user) throw ApiError.notFound("User not found")
  if (!user.hasStarted || user.hasSubmitted) {
    return ok(res, { count: user.violations.length, submitted: user.hasSubmitted }, "Ignored")
  }

  user.violations.push({ type, at: new Date() })

  const count = user.violations.length

  if (count >= env.maxViolations) {
    const result = await finalizeAttempt(user, { autoReason: "violations-exceeded" })
    return ok(
      res,
      { count, maxViolations: env.maxViolations, submitted: true, ...result },
      "Violation limit reached - your test was submitted"
    )
  }

  await user.save()

  return ok(
    res,
    {
      count,
      maxViolations: env.maxViolations,
      remaining: env.maxViolations - count,
      submitted: false
    },
    "Violation recorded"
  )
})

/**
 * Grades and closes an attempt. Shared by the manual submit path and by both
 * automatic paths (time expiry, violation limit) so scoring can never diverge.
 */
async function finalizeAttempt(user, { submitted = [], autoReason = null } = {}) {
  // Reload with the answer key attached; it is projected out by default.
  const gradable = await User.findByIdWithAnswerKey(user._id)
  const answerKey = buildAnswerKey(gradable.quiz?.questions || [])

  // Anything not present in this payload falls back to the last autosave.
  const fallback = user.responses.map((r) => ({
    questionId: r.questionId.toString(),
    selectedOption: r.selectedOption
  }))
  const merged = [...fallback, ...submitted]

  const { score, maxScore, attempted, total, responses } = gradeAttempt(merged, answerKey)

  user.responses = responses
  user.score = score
  user.maxScore = maxScore
  user.hasSubmitted = true
  user.submittedAt = new Date()
  user.timeUsed = user.getElapsedSeconds()
  user.autoSubmitted = Boolean(autoReason)
  user.autoSubmitReason = autoReason

  await user.save()

  // The score is deliberately withheld from the candidate.
  return {
    totalQuestions: total,
    attempted,
    timeUsed: user.timeUsed,
    autoSubmitted: user.autoSubmitted,
    autoSubmitReason: user.autoSubmitReason
  }
}

/**
 * POST /api/user/submit-quiz
 *
 * Grades server-side against the snapshot. The client-supplied elapsed time is
 * ignored entirely - `timeUsed` is derived from the server's own start anchor.
 */
export const submitQuiz = asyncHandler(async (req, res) => {
  const { responses } = parseOrThrow(submitSchema, req.body)

  const user = await User.findOne({ _id: req.user.id, email: req.user.email })
  if (!user) throw ApiError.notFound("User not found")

  if (!user.hasStarted || !user.quiz?.questions?.length) {
    throw ApiError.badRequest("Test has not been started")
  }
  if (user.hasSubmitted) {
    throw ApiError.badRequest("Test already submitted")
  }

  // Submitting after the clock ran out is allowed but flagged, so an attempt
  // that only landed late because of latency is not penalised.
  const expired = user.getOverdueSeconds() > SUBMIT_GRACE_SECONDS

  const result = await finalizeAttempt(user, {
    submitted: responses,
    autoReason: expired ? "time-expired" : null
  })

  res.clearCookie(SESSION_COOKIE, cookieOptions(0))

  return ok(res, { data: result }, "Test submitted successfully")
})
