import { useEffect, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { AlertTriangle, Loader2 } from "lucide-react"
import { formatDuration } from "./Timer"

/**
 * Submission confirmation.
 *
 * Modal semantics are hand-rolled rather than pulled from a library: focus is
 * moved in on open, Escape cancels, and the backdrop is inert so a stray click
 * outside cannot end an attempt.
 */
const SubmitDialog = ({ open, answered, total, timeRemaining, isSubmitting, onCancel, onConfirm }) => {
  const confirmRef = useRef(null)
  const unanswered = total - answered

  useEffect(() => {
    if (!open) return

    confirmRef.current?.focus()

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !isSubmitting) onCancel()
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, isSubmitting, onCancel])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-dialog-title"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-lift)]"
          >
            <div className="gdg-rule h-1" aria-hidden="true" />

            <div className="p-6">
              <h2 id="submit-dialog-title" className="text-xl font-semibold text-ink">
                Submit your test?
              </h2>
              <p className="mt-1.5 text-sm text-ink-muted">
                You cannot return to the paper once it is submitted.
              </p>

              <dl className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-line bg-canvas p-3 text-center">
                  <dt className="text-xs text-ink-subtle">Answered</dt>
                  <dd className="mt-0.5 font-mono text-xl font-semibold text-gdg-green">{answered}</dd>
                </div>
                <div className="rounded-xl border border-line bg-canvas p-3 text-center">
                  <dt className="text-xs text-ink-subtle">Left</dt>
                  <dd
                    className={`mt-0.5 font-mono text-xl font-semibold ${
                      unanswered > 0 ? "text-gdg-red" : "text-ink"
                    }`}
                  >
                    {unanswered}
                  </dd>
                </div>
                <div className="rounded-xl border border-line bg-canvas p-3 text-center">
                  <dt className="text-xs text-ink-subtle">Time left</dt>
                  <dd className="mt-0.5 font-mono text-xl font-semibold text-ink">
                    {formatDuration(timeRemaining)}
                  </dd>
                </div>
              </dl>

              {unanswered > 0 && (
                <p className="mt-4 flex items-start gap-2 rounded-xl border border-gdg-yellow/40 bg-gdg-yellow/10 p-3 text-sm text-[#7a5600]">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>
                    {unanswered} question{unanswered === 1 ? "" : "s"} unanswered. There is no negative
                    marking, so a guess costs you nothing.
                  </span>
                </p>
              )}

              <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink-muted transition hover:bg-canvas hover:text-ink disabled:opacity-50"
                >
                  Keep working
                </button>

                <button
                  type="button"
                  ref={confirmRef}
                  onClick={onConfirm}
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2 rounded-full bg-gdg-blue px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gdg-blue-dark disabled:opacity-60"
                >
                  {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  {isSubmitting ? "Submitting..." : "Submit test"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default SubmitDialog
