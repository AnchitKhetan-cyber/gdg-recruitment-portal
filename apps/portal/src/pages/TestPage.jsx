import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import { AlertTriangle, ChevronLeft, ChevronRight, CloudCheck, CloudUpload } from "lucide-react"
import { toast } from "sonner"
import { useQuizStore, useQuizProgress } from "../store/quiz.store"
import { useAuthStore } from "../store/auth.store"
import { useProctoring } from "../utils/useProctoring"
import Navbar from "../components/Navbar"
import Timer from "../components/Timer"
import QuestionCard from "../components/QuestionCard"
import QuestionPalette from "../components/QuestionPalette"
import SubmitDialog from "../components/SubmitDialog"
import ProctorCamera from "../components/ProctorCamera"
import FullscreenGate from "../components/FullscreenGate"
import Loading from "../components/Loading"
import {
  enterFullscreen,
  exitFullscreen,
  isFullscreen,
  isFullscreenSupported
} from "../utils/fullscreen"

const AUTOSAVE_INTERVAL_MS = 12_000

const TestPage = () => {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const {
    status,
    error,
    quiz,
    answers,
    visited,
    currentIndex,
    timeRemaining,
    violations,
    maxViolations,
    pendingSave,
    lastSavedAt,
    load,
    selectOption,
    goTo,
    next,
    previous,
    tick,
    save,
    submit,
    reportViolation,
    reset
  } = useQuizStore()

  const progress = useQuizProgress()

  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [warning, setWarning] = useState(null)
  const expiredRef = useRef(false)

  // Fullscreen is requested by the click on the instructions page, which
  // carries the user gesture the browser demands. If it did not take, the gate
  // goes up here and asks for a click of its own.
  const [fullscreenOk, setFullscreenOk] = useState(() => isFullscreen())
  const fullscreenUnsupported = !isFullscreenSupported()

  /* ------------------------------------------------------------- load */

  useEffect(() => {
    load().catch((err) => {
      if (/already submitted/i.test(err.message)) {
        navigate("/submitted", { replace: true })
        return
      }
      if (err.status === 401 || err.status === 403) {
        navigate("/", { replace: true })
        return
      }
      toast.error(err.message)
    })

    return () => reset()
  }, [load, reset, navigate])

  /* ------------------------------------------------------------ timer */

  const handleTimeUp = useCallback(async () => {
    if (expiredRef.current) return
    expiredRef.current = true

    toast.warning("Time is up. Submitting your answers.")
    await submit().catch(() => {})
    navigate("/submitted", { replace: true, state: { reason: "time-expired" } })
  }, [submit, navigate])

  useEffect(() => {
    if (status !== "ready") return undefined

    const interval = setInterval(() => {
      const remaining = tick()
      if (remaining <= 0) handleTimeUp()
    }, 1000)

    return () => clearInterval(interval)
  }, [status, tick, handleTimeUp])

  /* --------------------------------------------------------- autosave */

  useEffect(() => {
    if (status !== "ready") return undefined

    const interval = setInterval(() => {
      save().then((closed) => {
        if (closed) navigate("/submitted", { replace: true, state: { reason: "time-expired" } })
      })
    }, AUTOSAVE_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [status, save, navigate])

  // Best-effort flush when the tab goes away, so the last answer is not lost.
  useEffect(() => {
    const flush = () => {
      if (useQuizStore.getState().pendingSave) save()
    }
    document.addEventListener("visibilitychange", flush)
    return () => document.removeEventListener("visibilitychange", flush)
  }, [save])

  /* -------------------------------------------------------- proctoring */

  /** Camera findings are advisory: recorded for review, never a warning banner. */
  const handleCameraFlag = useCallback(
    ({ type, detail, confidence }) => reportViolation(type, { detail, confidence }),
    [reportViolation]
  )

  const handleViolation = useCallback(
    async (type) => {
      const result = await reportViolation(type)
      if (!result) return

      if (result.submitted) {
        toast.error("Too many tab switches. Your test has been submitted.")
        navigate("/submitted", { replace: true, state: { reason: "violations-exceeded" } })
        return
      }

      setWarning({
        count: result.count,
        remaining: result.remaining,
        id: Date.now()
      })
    },
    [reportViolation, navigate]
  )

  const handleFullscreenLost = useCallback(() => setFullscreenOk(false), [])

  useProctoring({
    active: status === "ready",
    onViolation: handleViolation,
    onFullscreenLost: handleFullscreenLost
  })

  const handleReturnToFullscreen = async () => {
    if (fullscreenUnsupported) {
      // Nothing to enter; let them sit the test with the exception recorded.
      setFullscreenOk(true)
      return
    }
    const entered = await enterFullscreen()
    setFullscreenOk(entered)
  }

  // Release fullscreen once the attempt is over, so the success page is normal.
  useEffect(() => {
    if (status === "submitted") exitFullscreen()
  }, [status])

  useEffect(() => {
    if (!warning) return undefined
    const timeout = setTimeout(() => setWarning(null), 6000)
    return () => clearTimeout(timeout)
  }, [warning])

  /* ------------------------------------------------- keyboard shortcuts */

  useEffect(() => {
    if (status !== "ready") return undefined

    const onKeyDown = (event) => {
      if (event.target.matches("input, textarea, button") && event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return
      }
      if (event.key === "ArrowRight") next()
      if (event.key === "ArrowLeft") previous()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [status, next, previous])

  /* ----------------------------------------------------------- submit */

  const handleSubmit = async () => {
    try {
      await submit()
      setShowSubmitDialog(false)
      navigate("/submitted", { replace: true, state: { reason: "manual" } })
    } catch (err) {
      setShowSubmitDialog(false)
      toast.error(err.message)
    }
  }

  /* ------------------------------------------------------------ render */

  if (status === "idle" || status === "loading") return <Loading label="Preparing your paper" />

  if (status === "error") {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas px-6">
        <div className="gdg-card max-w-md p-8 text-center">
          <AlertTriangle className="mx-auto size-8 text-gdg-red" aria-hidden="true" />
          <h1 className="mt-4 text-lg font-semibold text-ink">Could not open your test</h1>
          <p className="mt-2 text-sm text-ink-muted">{error}</p>
          <button
            type="button"
            onClick={() => load().catch(() => {})}
            className="mt-6 rounded-full bg-gdg-blue px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-gdg-blue-dark"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!quiz) return <Loading label="Preparing your paper" />

  const question = quiz.questions[currentIndex]
  const totalSeconds = quiz.duration * 60
  const isSubmitting = status === "submitting"

  return (
    <div className="min-h-dvh bg-canvas">
      <Navbar
        user={user}
        showSignOut={false}
        right={<Timer seconds={timeRemaining} totalSeconds={totalSeconds} />}
      />

      {/* Violation banner */}
      <AnimatePresence>
        {warning && (
          <motion.div
            key={warning.id}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            role="alert"
            className="sticky top-16 z-20 border-b border-gdg-red/30 bg-gdg-red/[0.08]"
          >
            <div className="mx-auto flex max-w-7xl items-start gap-2.5 px-4 py-3 text-sm text-gdg-red sm:px-6">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>
                <strong className="font-semibold">Tab switch detected.</strong> This was recorded.{" "}
                {warning.remaining} more will submit your test automatically.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        {/* Paper */}
        <div className="min-w-0">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-gdg-blue transition-[width] duration-300"
                style={{ width: `${((currentIndex + 1) / progress.total) * 100}%` }}
                role="progressbar"
                aria-valuenow={currentIndex + 1}
                aria-valuemin={1}
                aria-valuemax={progress.total}
                aria-label="Progress through the paper"
              />
            </div>
            <p className="shrink-0 font-mono text-xs text-ink-subtle tabular-nums">
              {progress.answered}/{progress.total} answered
            </p>
          </div>

          <AnimatePresence mode="wait">
            <QuestionCard
              key={question.id}
              question={question}
              index={currentIndex}
              total={progress.total}
              selectedOption={answers[question.id]}
              onSelect={(optionIndex) => selectOption(question.id, optionIndex)}
            />
          </AnimatePresence>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={previous}
              disabled={currentIndex === 0}
              className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              Previous
            </button>

            {currentIndex < progress.total - 1 ? (
              <button
                type="button"
                onClick={next}
                className="ml-auto flex items-center gap-1.5 rounded-full bg-gdg-blue px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-gdg-blue-dark"
              >
                Next
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowSubmitDialog(true)}
                className="ml-auto rounded-full bg-gdg-green px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
              >
                Review and submit
              </button>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="gdg-card p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-ink">Questions</h2>
              <span className="font-mono text-xs text-ink-subtle tabular-nums">
                {progress.answered}/{progress.total}
              </span>
            </div>

            <QuestionPalette
              questions={quiz.questions}
              answers={answers}
              visited={visited}
              currentIndex={currentIndex}
              onJump={goTo}
            />

            <button
              type="button"
              onClick={() => setShowSubmitDialog(true)}
              className="mt-5 w-full rounded-full bg-gdg-green px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
            >
              Submit test
            </button>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-ink-subtle">
              {pendingSave ? (
                <>
                  <CloudUpload className="size-3.5" aria-hidden="true" />
                  Saving...
                </>
              ) : (
                <>
                  <CloudCheck className="size-3.5 text-gdg-green" aria-hidden="true" />
                  {lastSavedAt ? "All answers saved" : "Answers save automatically"}
                </>
              )}
            </p>
          </div>

          <ProctorCamera active={status === "ready"} onFlag={handleCameraFlag} />

          {violations > 0 && (
            <div className="rounded-xl border border-gdg-red/30 bg-gdg-red/[0.06] p-3 text-xs text-gdg-red">
              <strong className="font-semibold">
                {violations} of {maxViolations}
              </strong>{" "}
              tab-switch warnings used.
            </div>
          )}
        </aside>
      </main>

      <FullscreenGate
        open={status === "ready" && !fullscreenOk}
        unsupported={fullscreenUnsupported}
        violations={violations}
        maxViolations={maxViolations}
        onReturn={handleReturnToFullscreen}
      />

      <SubmitDialog
        open={showSubmitDialog}
        answered={progress.answered}
        total={progress.total}
        timeRemaining={timeRemaining}
        isSubmitting={isSubmitting}
        onCancel={() => setShowSubmitDialog(false)}
        onConfirm={handleSubmit}
      />
    </div>
  )
}

export default TestPage
