import { Clock } from "lucide-react"

export const formatDuration = (totalSeconds) => {
  const safe = Math.max(0, Math.floor(totalSeconds || 0))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

/**
 * The attempt clock.
 *
 * Displays whatever the store holds; the store is seeded and periodically
 * re-synced from the server, so this is presentation only.
 */
const Timer = ({ seconds, totalSeconds }) => {
  const isCritical = seconds <= 60
  const isWarning = !isCritical && seconds <= 300
  const progress = totalSeconds ? Math.max(0, Math.min(1, seconds / totalSeconds)) : 0

  const tone = isCritical
    ? "border-gdg-red/40 bg-gdg-red/10 text-gdg-red"
    : isWarning
      ? "border-gdg-yellow/50 bg-gdg-yellow/10 text-[#8a6100]"
      : "border-line bg-surface text-ink"

  return (
    <div
      className={`flex items-center gap-2.5 rounded-full border px-3.5 py-2 transition-colors ${tone}`}
      role="timer"
      aria-live={isCritical ? "assertive" : "off"}
      aria-label={`Time remaining: ${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds`}
    >
      <Clock className={`size-4 ${isCritical ? "animate-pulse" : ""}`} aria-hidden="true" />

      <span className="font-mono text-base font-semibold tabular-nums tracking-tight">
        {formatDuration(seconds)}
      </span>

      <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-black/10 sm:block" aria-hidden="true">
        <span
          className={`block h-full rounded-full transition-[width] duration-1000 ease-linear ${
            isCritical ? "bg-gdg-red" : isWarning ? "bg-gdg-yellow" : "bg-gdg-green"
          }`}
          style={{ width: `${progress * 100}%` }}
        />
      </span>
    </div>
  )
}

export default Timer
