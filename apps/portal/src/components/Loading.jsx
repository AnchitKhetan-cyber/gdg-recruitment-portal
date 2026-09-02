import { GdgMark } from "./Brand"

/** Full-page loading state. */
const Loading = ({ label = "Loading" }) => (
  <div className="grid min-h-dvh place-items-center bg-canvas px-6">
    <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
      <div className="animate-pulse">
        <GdgMark size={44} />
      </div>
      <p className="text-sm font-medium text-ink-muted">{label}...</p>
    </div>
  </div>
)

export default Loading
