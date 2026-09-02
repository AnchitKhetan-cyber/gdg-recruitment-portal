/**
 * Creates (or refreshes) the sample quiz and makes it the active paper.
 *
 *   npm run seed:quiz
 *   npm run seed:quiz -- --replace     # overwrite the existing sample quiz
 */
import { connectDataBase, disconnectDataBase } from "../config/db.js"
import { Quiz } from "../models/quiz.model.js"
import { sampleQuestions } from "./sample_questions.js"

const REPLACE = process.argv.includes("--replace")
const TITLE = "GDG Technical Screening 2026"

const run = async () => {
  await connectDataBase()

  const existing = await Quiz.findOne({ title: TITLE })

  if (existing && !REPLACE) {
    console.log(`[quiz] "${TITLE}" already exists with ${existing.questions.length} question(s).`)
    console.log("[quiz] pass --replace to overwrite it.")
    await disconnectDataBase()
    return
  }

  if (existing) {
    existing.questions = sampleQuestions
    existing.duration = 15
    existing.questionsPerAttempt = 15
    await existing.save()
    await Quiz.activateOnly(existing._id)
    console.log(`[quiz] replaced "${TITLE}" with ${sampleQuestions.length} question(s), now active`)
  } else {
    const quiz = await Quiz.create({
      title: TITLE,
      description:
        "A timed multiple-choice screening covering data structures, web fundamentals, and general engineering practice.",
      duration: 15,
      questionsPerAttempt: 15,
      questions: sampleQuestions,
      isActive: true
    })
    await Quiz.activateOnly(quiz._id)
    console.log(`[quiz] created "${TITLE}" with ${quiz.questions.length} question(s), now active`)
  }

  await disconnectDataBase()
}

run().catch((error) => {
  console.error("[quiz] failed:", error.message)
  process.exit(1)
})
