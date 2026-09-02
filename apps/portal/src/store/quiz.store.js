import { create } from "zustand"
import { useShallow } from "zustand/react/shallow"
import { api } from "../api/client"

/**
 * The whole attempt state machine.
 *
 * Deliberately holds no timer anchor of its own: `timeRemaining` is seeded by
 * the server on load and re-synced on every autosave, so the clock cannot be
 * reset by clearing browser storage.
 */
const initialState = {
  status: "idle", // idle | loading | ready | submitting | submitted | error
  error: null,

  quiz: null,
  answers: {}, // questionId -> option index
  visited: {}, // questionId -> true
  currentIndex: 0,

  timeRemaining: 0,
  violations: 0, // enforced events; these can end the attempt
  flags: 0, // advisory camera findings; recorded for review only
  maxViolations: 4,

  pendingSave: false,
  lastSavedAt: null,
  submission: null
}

export const useQuizStore = create((set, get) => ({
  ...initialState,

  reset: () => set({ ...initialState }),

  /** Fetches or resumes the attempt. */
  load: async () => {
    set({ status: "loading", error: null })

    try {
      const data = await api.startQuiz()

      const answers = {}
      for (const response of data.responses || []) {
        if (response.selectedOption >= 0) answers[response.questionId] = response.selectedOption
      }

      const firstQuestion = data.quiz.questions[0]

      set({
        status: "ready",
        quiz: data.quiz,
        answers,
        visited: firstQuestion ? { [firstQuestion.id]: true } : {},
        currentIndex: 0,
        timeRemaining: data.timeRemaining,
        violations: data.violations || 0,
        maxViolations: data.maxViolations || 4
      })

      return data
    } catch (error) {
      set({ status: "error", error: error.message })
      throw error
    }
  },

  selectOption: (questionId, optionIndex) => {
    const { answers } = get()
    // Clicking the selected option again clears it, so an accidental tap is undoable.
    const next = { ...answers }
    if (next[questionId] === optionIndex) delete next[questionId]
    else next[questionId] = optionIndex

    set({ answers: next, pendingSave: true })
  },

  goTo: (index) => {
    const { quiz } = get()
    if (!quiz || index < 0 || index >= quiz.questions.length) return

    const question = quiz.questions[index]
    set((state) => ({
      currentIndex: index,
      visited: { ...state.visited, [question.id]: true }
    }))
  },

  next: () => get().goTo(get().currentIndex + 1),
  previous: () => get().goTo(get().currentIndex - 1),

  tick: () => {
    const { timeRemaining, status } = get()
    if (status !== "ready") return timeRemaining
    const remaining = Math.max(0, timeRemaining - 1)
    set({ timeRemaining: remaining })
    return remaining
  },

  /** Serialises the current answers into the API's response shape. */
  buildResponses: () => {
    const { quiz, answers } = get()
    if (!quiz) return []

    return quiz.questions.map((question) => ({
      questionId: question.id,
      selectedOption: answers[question.id] ?? -1
    }))
  },

  /** Autosave. Returns true when the server ended the attempt for us. */
  save: async () => {
    const { status, pendingSave, buildResponses } = get()
    if (status !== "ready" || !pendingSave) return false

    try {
      const data = await api.saveProgress(buildResponses())

      set({ pendingSave: false, lastSavedAt: Date.now() })

      if (data.submitted) {
        set({ status: "submitted", submission: data, timeRemaining: 0 })
        return true
      }

      // Trust the server's clock over our own local countdown.
      if (typeof data.timeRemaining === "number") set({ timeRemaining: data.timeRemaining })
      return false
    } catch {
      // A failed autosave is not fatal - the answers stay in memory and the
      // next tick will retry. Only a submit failure is surfaced to the user.
      return false
    }
  },

  reportViolation: async (type, extra = {}) => {
    if (get().status !== "ready") return null

    try {
      const data = await api.reportViolation(type, extra)
      // `count` is the enforced total; camera flags do not move it.
      set({ violations: data.count, flags: data.flags ?? get().flags })

      if (data.submitted) {
        set({ status: "submitted", submission: data })
      }

      return data
    } catch {
      return null
    }
  },

  submit: async () => {
    const { status, buildResponses } = get()
    if (status === "submitting" || status === "submitted") return null

    set({ status: "submitting", error: null })

    try {
      const data = await api.submitQuiz(buildResponses())
      set({ status: "submitted", submission: data.data, pendingSave: false })
      return data.data
    } catch (error) {
      // "Already submitted" means the server closed the attempt first (time or
      // violations) - treat that as success rather than showing a scary error.
      if (/already submitted/i.test(error.message)) {
        set({ status: "submitted", submission: null })
        return null
      }
      set({ status: "ready", error: error.message })
      throw error
    }
  }
}))

const selectProgress = (state) => {
  const total = state.quiz?.questions.length || 0
  const answered = state.quiz
    ? state.quiz.questions.filter((q) => state.answers[q.id] !== undefined).length
    : 0

  return { total, answered, unanswered: total - answered }
}

/**
 * Derived counts for the palette and the submit dialog.
 *
 * Wrapped in `useShallow` because the selector builds a fresh object on every
 * call - without it React sees a new snapshot each render and loops forever.
 */
export const useQuizProgress = () => useQuizStore(useShallow(selectProgress))
