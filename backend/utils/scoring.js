/**
 * Attempt scoring.
 *
 * The answer key lives only on the candidate's quiz snapshot and is loaded via
 * `User.findByIdWithAnswerKey`, so these helpers are the only code that ever
 * sees a correct option.
 */

/** Indexes an answer key by question id for O(1) lookup during grading. */
export const buildAnswerKey = (questions = []) => {
  const key = new Map()

  for (const question of questions) {
    if (!question?.id) continue
    key.set(question.id.toString(), {
      correctIndex: Number.isInteger(question.correctAnswers) ? question.correctAnswers : -1,
      correctText: question.answer || "",
      options: question.options || [],
      marks: question.marks ?? 1
    })
  }

  return key
}

const isCorrect = (entry, selectedIndex) => {
  if (selectedIndex < 0) return false

  if (entry.correctIndex >= 0) {
    return selectedIndex === entry.correctIndex
  }

  // Fall back to comparing option text when a legacy question carries no index.
  const selectedText = entry.options[selectedIndex]
  if (!entry.correctText || !selectedText) return false
  return entry.correctText.trim().toLowerCase() === selectedText.trim().toLowerCase()
}

/**
 * Grades a submission against the answer key.
 *
 * Every question in the key produces a response row, so an unanswered question
 * is recorded as `selectedOption: -1` rather than being silently omitted.
 */
export const gradeAttempt = (submitted = [], answerKey) => {
  const chosen = new Map()

  for (const response of submitted) {
    if (!response?.questionId) continue
    const index = Number.isInteger(response.selectedOption) ? response.selectedOption : -1
    chosen.set(String(response.questionId), index)
  }

  let score = 0
  let maxScore = 0
  let attempted = 0
  const responses = []

  for (const [questionId, entry] of answerKey) {
    const selectedOption = chosen.has(questionId) ? chosen.get(questionId) : -1
    // Guard against an out-of-range index from a tampered client payload.
    const safeOption = selectedOption < entry.options.length ? selectedOption : -1
    const correct = isCorrect(entry, safeOption)

    maxScore += entry.marks
    if (safeOption >= 0) attempted += 1
    if (correct) score += entry.marks

    responses.push({ questionId, selectedOption: safeOption, isCorrect: correct })
  }

  return { score, maxScore, attempted, total: answerKey.size, responses }
}

/**
 * Merges an autosave payload into the stored responses without grading, so a
 * partially completed attempt survives a refresh or a crashed browser.
 */
export const mergeProgress = (existing = [], incoming = [], validQuestionIds) => {
  const merged = new Map(existing.map((r) => [String(r.questionId), r]))

  for (const response of incoming) {
    const questionId = String(response?.questionId || "")
    if (!validQuestionIds.has(questionId)) continue

    const index = Number.isInteger(response.selectedOption) ? response.selectedOption : -1
    merged.set(questionId, { questionId, selectedOption: index, isCorrect: false })
  }

  return [...merged.values()]
}
