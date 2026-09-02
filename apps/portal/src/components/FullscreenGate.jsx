import { Maximize, ShieldAlert } from "lucide-react"

/**
 * Blocks the paper whenever the candidate is not in fullscreen.
 *
 * This is the enforcement, since the exit itself cannot be prevented: the
 * questions are covered until they return, and the clock keeps running because
 * it is owned by the server. Re-entering needs a real click, as the browser
 * only grants fullscreen from a user gesture.
 */
const FullscreenGate = ({ open, onReturn, violations, maxViolations, unsupported }) => {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-canvas/95 p-6 backdrop-blur-md"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="fullscreen-gate-title"
    >
      <div className="gdg-card w-full max-w-md overflow-hidden text-center">
        <div className="gdg-rule h-1" aria-hidden="true" />

        <div className="p-8">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-gdg-red/10">
            <ShieldAlert className="size-7 text-gdg-red" aria-hidden="true" />
          </div>

          <h2 id="fullscreen-gate-title" className="mt-5 text-xl font-semibold text-ink">
            {unsupported ? "Fullscreen is unavailable" : "Return to fullscreen"}
          </h2>

          <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
            {unsupported
              ? "Your browser will not allow fullscreen. You can continue, but this has been recorded for the organisers."
              : "This assessment runs in fullscreen. Your questions are hidden until you return, and the clock is still running."}
          </p>

          {!unsupported && violations > 0 && (
            <p className="mt-4 rounded-xl border border-gdg-red/30 bg-gdg-red/[0.06] px-4 py-2.5 text-sm font-medium text-gdg-red">
              {violations} of {maxViolations} warnings used
            </p>
          )}

          <button
            type="button"
            onClick={onReturn}
            autoFocus
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gdg-blue px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-gdg-blue-dark"
          >
            <Maximize className="size-4" aria-hidden="true" />
            {unsupported ? "Continue anyway" : "Re-enter fullscreen"}
          </button>

          {!unsupported && (
            <p className="mt-4 text-xs text-ink-subtle">
              Pressing Escape or F11 leaves fullscreen. Each exit is recorded.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default FullscreenGate
