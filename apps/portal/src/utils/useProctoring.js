import { useEffect, useRef } from "react"
import { onFullscreenChange } from "./fullscreen"

/**
 * Reports focus-loss events to the server while an attempt is live.
 *
 * The count itself lives on the server; this hook only reports. Two guards keep
 * the signal honest: a short cooldown, so one alt-tab cannot fire several
 * events, and a `blur` fallback for browsers that do not raise
 * `visibilitychange` when another window takes focus.
 */
const COOLDOWN_MS = 1500

export const useProctoring = ({ active, paused = false, onViolation, onFullscreenLost }) => {
  const lastReportRef = useRef(0)
  const onViolationRef = useRef(onViolation)
  const onFullscreenLostRef = useRef(onFullscreenLost)
  // Read live so toggling `paused` never needs to re-attach the listeners.
  const pausedRef = useRef(paused)

  useEffect(() => {
    onViolationRef.current = onViolation
    onFullscreenLostRef.current = onFullscreenLost
    pausedRef.current = paused
  }, [onViolation, onFullscreenLost, paused])

  useEffect(() => {
    if (!active) return undefined

    const report = (type) => {
      const now = Date.now()
      if (now - lastReportRef.current < COOLDOWN_MS) return
      lastReportRef.current = now
      onViolationRef.current?.(type)
    }

    // While a gate is up (camera off, or out of fullscreen), the candidate is
    // being told to fix something - clicking the browser's permission control
    // steals focus. Do not count that as a tab switch or window blur.
    const onVisibilityChange = () => {
      if (document.hidden && !pausedRef.current) report("tab-switch")
    }

    const onBlur = () => {
      if (!pausedRef.current) report("window-blur")
    }

    const onCopyOrPaste = (event) => {
      event.preventDefault()
      report(event.type === "copy" ? "copy" : "paste")
    }

    const onContextMenu = (event) => event.preventDefault()

    // Warn before a refresh or a close; the browser shows its own generic text.
    const onBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ""
    }

    // Leaving fullscreen gets its own channel: the gate has to go up
    // immediately, and it is reported outside the shared cooldown so an exit
    // is never swallowed by a blur that fired a moment earlier.
    const unsubscribeFullscreen = onFullscreenChange((isActive) => {
      if (isActive) return
      onFullscreenLostRef.current?.()
      onViolationRef.current?.("fullscreen-exit")
    })

    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("blur", onBlur)
    document.addEventListener("copy", onCopyOrPaste)
    document.addEventListener("paste", onCopyOrPaste)
    document.addEventListener("contextmenu", onContextMenu)
    window.addEventListener("beforeunload", onBeforeUnload)

    return () => {
      unsubscribeFullscreen()
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("blur", onBlur)
      document.removeEventListener("copy", onCopyOrPaste)
      document.removeEventListener("paste", onCopyOrPaste)
      document.removeEventListener("contextmenu", onContextMenu)
      window.removeEventListener("beforeunload", onBeforeUnload)
    }
  }, [active])
}
