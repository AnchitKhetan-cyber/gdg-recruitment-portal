/**
 * Fullscreen helpers.
 *
 * A browser will never let a page *prevent* an exit - Escape and F11 are
 * guaranteed escapes, deliberately, so a web page cannot trap a user. The most
 * an assessment can do is require fullscreen to start, notice every exit, and
 * refuse to show the paper until the candidate returns. That is what this
 * supports.
 *
 * Entering fullscreen requires a user gesture, so `requestFullscreen` must be
 * called directly from a click handler - never from an effect or a timer.
 */

/** Vendor-prefixed forms, still needed for Safari. */
export const isFullscreen = () =>
  Boolean(document.fullscreenElement || document.webkitFullscreenElement)

export const isFullscreenSupported = () =>
  Boolean(
    document.documentElement.requestFullscreen ||
      document.documentElement.webkitRequestFullscreen
  )

/**
 * Enters fullscreen. Resolves to true on success.
 *
 * Never throws: a candidate whose browser or OS refuses fullscreen must still
 * be able to sit the test, so callers treat false as "carry on, but flag it".
 */
export const enterFullscreen = async () => {
  const element = document.documentElement

  try {
    if (element.requestFullscreen) {
      await element.requestFullscreen({ navigationUI: "hide" })
    } else if (element.webkitRequestFullscreen) {
      await element.webkitRequestFullscreen()
    } else {
      return false
    }
    return true
  } catch {
    // Denied by the browser, blocked by policy, or called without a gesture.
    return false
  }
}

export const exitFullscreen = async () => {
  if (!isFullscreen()) return

  try {
    if (document.exitFullscreen) await document.exitFullscreen()
    else if (document.webkitExitFullscreen) await document.webkitExitFullscreen()
  } catch {
    // Nothing useful to do; the attempt is ending either way.
  }
}

/** Subscribes to fullscreen changes. Returns an unsubscribe function. */
export const onFullscreenChange = (handler) => {
  const listener = () => handler(isFullscreen())

  document.addEventListener("fullscreenchange", listener)
  document.addEventListener("webkitfullscreenchange", listener)

  return () => {
    document.removeEventListener("fullscreenchange", listener)
    document.removeEventListener("webkitfullscreenchange", listener)
  }
}
