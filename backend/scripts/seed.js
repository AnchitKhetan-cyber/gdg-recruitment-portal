/**
 * Seeds the local database with one active quiz and a small whitelist.
 *
 *   npm run seed                 # add if missing
 *   npm run seed -- --reset      # wipe quizzes/whitelist/attempts first
 */
import mongoose from "mongoose"
import { connectDataBase, disconnectDataBase } from "../config/db.js"
import { Allowed } from "../models/allowed.model.js"
import { Quiz } from "../models/quiz.model.js"
import { User } from "../models/user.model.js"
import { sampleQuestions } from "./sample_questions.js"

const RESET = process.argv.includes("--reset")

const sampleCandidates = [
  { name: "Aarav Sharma", email: "aarav.sharma@example.com", phone: "9000000001", tag: "2027" },
  { name: "Diya Verma", email: "diya.verma@example.com", phone: "9000000002", tag: "2027" },
  { name: "Kabir Nair", email: "kabir.nair@example.com", phone: "9000000003", tag: "2026" },
  { name: "Ishita Rao", email: "ishita.rao@example.com", phone: "9000000004", tag: "2026" },
  { name: "Rohan Gupta", email: "rohan.gupta@example.com", phone: "9000000005", tag: "2027" }
]

export const seed = async ({ reset = false, quiet = false } = {}) => {
  const log = (...args) => !quiet && console.log(...args)

  if (reset) {
    await Promise.all([Quiz.deleteMany({}), Allowed.deleteMany({}), User.deleteMany({})])
    log("[seed] cleared quizzes, whitelist and attempts")
  }

  let quiz = await Quiz.findOne({ title: "GDG Technical Screening 2026" })

  if (!quiz) {
    quiz = await Quiz.create({
      title: "GDG Technical Screening 2026",
      description:
        "A timed multiple-choice screening covering data structures, web fundamentals, and general engineering practice.",
      duration: 15,
      questionsPerAttempt: 15,
      questions: sampleQuestions,
      isActive: true
    })
    await Quiz.activateOnly(quiz._id)
    log(`[seed] created quiz "${quiz.title}" with ${quiz.questions.length} questions (active)`)
  } else {
    log(`[seed] quiz "${quiz.title}" already exists`)
  }

  const operations = sampleCandidates.map((candidate) => ({
    updateOne: {
      filter: { email: candidate.email },
      update: { $setOnInsert: candidate },
      upsert: true
    }
  }))

  const result = await Allowed.bulkWrite(operations, { ordered: false })
  log(`[seed] whitelist: ${result.upsertedCount || 0} added, ${await Allowed.countDocuments()} total`)

  return quiz
}

// Only run when invoked directly, not when imported by the in-memory runner.
const isDirectRun = process.argv[1] && process.argv[1].endsWith("seed.js")

if (isDirectRun) {
  connectDataBase()
    .then(() => seed({ reset: RESET }))
    .then(async () => {
      await disconnectDataBase()
      console.log("[seed] done")
      process.exit(0)
    })
    .catch(async (error) => {
      console.error("[seed] failed:", error.message)
      await mongoose.connection.close().catch(() => {})
      process.exit(1)
    })
}
