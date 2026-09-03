/**
 * Regression tests for the attempt store.
 *
 *   npm run test --prefix apps/portal
 *
 * These cover two bugs that shipped green: the test suite exercised the paths
 * the author had in mind, not the ones candidates actually hit. Both are about
 * losing a candidate's work, so both are worth locking down.
 *
 * Run under plain Node with a stubbed API module - no browser needed, because
 * none of this logic touches the DOM.
 */
import assert from "node:assert/strict"
import { mock } from "node:test"

// Stub the API before the store imports it.
const calls = []
let resolveNext = null

mock.module("../api/client.js", {
  namedExports: {
    api: {
      saveProgress: (responses) => {
        calls.push(responses)
        // Hand control back to the test so it can interleave a user action.
        return new Promise((resolve) => {
          resolveNext = () => resolve({ submitted: false, timeRemaining: 600, saved: responses.length })
        })
      },
      startQuiz: async () => ({}),
      submitQuiz: async () => ({ data: {} }),
      reportViolation: async () => ({})
    }
  }
})

const { useQuizStore } = await import("./quiz.store.js")

let passed = 0
let failed = 0

const test = async (name, fn) => {
  try {
    await fn()
    passed += 1
    console.log(`  ✓ ${name}`)
  } catch (error) {
    failed += 1
    console.error(`  ✗ ${name}\n      ${error.message}`)
  }
}

const seedAttempt = () => {
  useQuizStore.setState({
    status: "ready",
    quiz: {
      duration: 15,
      questions: [
        { id: "q1", options: ["a", "b"] },
        { id: "q2", options: ["a", "b"] }
      ]
    },
    answers: {},
    visited: {},
    currentIndex: 0,
    timeRemaining: 900,
    pendingSave: false,
    lastSavedAt: null
  })
  calls.length = 0
}

console.log("\nAttempt store\n")

await test("an answer given while a save is in flight is not marked as saved", async () => {
  seedAttempt()
  const store = useQuizStore.getState()

  store.selectOption("q1", 1)
  assert.equal(useQuizStore.getState().pendingSave, true)

  // Autosave leaves; it carries q1 only.
  const inFlight = store.save()
  assert.equal(calls.length, 1)

  // The candidate answers q2 before the response lands.
  useQuizStore.getState().selectOption("q2", 0)

  resolveNext()
  await inFlight

  assert.equal(
    useQuizStore.getState().pendingSave,
    true,
    "q2 was never sent, so the attempt must still be pending a save"
  )

  // The next tick must actually send it, rather than skipping.
  const second = useQuizStore.getState().save()
  assert.equal(calls.length, 2, "the follow-up autosave must fire")
  const sent = calls[1]
  assert.deepEqual(
    sent.find((r) => r.questionId === "q2"),
    { questionId: "q2", selectedOption: 0 },
    "the second request must carry the answer given mid-flight"
  )

  resolveNext()
  await second
  assert.equal(useQuizStore.getState().pendingSave, false, "now everything is saved")
})

await test("a save with no changes in flight clears the pending flag", async () => {
  seedAttempt()
  useQuizStore.getState().selectOption("q1", 0)

  const inFlight = useQuizStore.getState().save()
  resolveNext()
  await inFlight

  assert.equal(useQuizStore.getState().pendingSave, false)
  assert.ok(useQuizStore.getState().lastSavedAt, "lastSavedAt should be stamped")
})

await test("selecting the same option twice clears the answer", () => {
  seedAttempt()
  const { selectOption } = useQuizStore.getState()

  selectOption("q1", 1)
  assert.equal(useQuizStore.getState().answers.q1, 1)

  selectOption("q1", 1)
  assert.equal(
    useQuizStore.getState().answers.q1,
    undefined,
    "re-selecting the same option must clear it"
  )
})

await test("an unanswered question is submitted as -1, not omitted", () => {
  seedAttempt()
  useQuizStore.getState().selectOption("q1", 1)

  const responses = useQuizStore.getState().buildResponses()
  assert.equal(responses.length, 2)
  assert.deepEqual(responses[1], { questionId: "q2", selectedOption: -1 })
})

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed ? 1 : 0)
