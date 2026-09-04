import { CameraOff, Loader2 } from "lucide-react"

/**
 * Blocks the paper whenever the camera is off during a live attempt.
 *
 * Turning the camera off - revoking permission, an OS toggle - would otherwise
 * silently disable monitoring while the candidate keeps writing. The questions
 * are covered until the camera is back, the server-owned clock keeps running,
 * and the event is recorded. Re-enabling needs a real click, because the
 * browser only re-prompts for a revoked permission from a user gesture.
 */
const CameraGate = ({ open, retrying, onRetry }) => {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-canvas/95 p-6 backdrop-blur-md"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="camera-gate-title"
    >
      <div className="gdg-card w-full max-w-md overflow-hidden text-center">
        <div className="gdg-rule h-1" aria-hidden="true" />

        <div className="p-8">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-gdg-red/10">
            <CameraOff className="size-7 text-gdg-red" aria-hidden="true" />
          </div>

          <h2 id="camera-gate-title" className="mt-5 text-xl font-semibold text-ink">
            Turn your camera back on
          </h2>

          <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
            Your camera is required for the whole test. Your questions are hidden until it is back
            on, the clock is still running, and this was recorded.
          </p>

          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            autoFocus
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gdg-blue px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-gdg-blue-dark disabled:opacity-60"
          >
            {retrying && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {retrying ? "Checking..." : "Re-enable camera and continue"}
          </button>

          <p className="mt-4 text-xs text-ink-subtle">
            If the browser blocked it, click the camera icon in the address bar, choose Allow, then
            press the button above.
          </p>
        </div>
      </div>
    </div>
  )
}

export default CameraGate
