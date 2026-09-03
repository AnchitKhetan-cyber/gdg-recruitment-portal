import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowRight,
  Camera,
  Check,
  Maximize,
  Mic,
  RefreshCw,
  Wifi,
  X
} from "lucide-react"
import { toast } from "sonner"
import { api } from "../api/client"
import { useAuthStore } from "../store/auth.store"
import { useMediaCheck } from "../utils/useMediaCheck"
import { enterFullscreen, isFullscreen, isFullscreenSupported, onFullscreenChange } from "../utils/fullscreen"
import Navbar from "../components/Navbar"
import { BrandRule } from "../components/Brand"

/**
 * Pre-flight checks, run between the instructions and the paper.
 *
 * Everything that can steal focus or interrupt - the camera and microphone
 * prompt, entering fullscreen, a flaky connection - happens HERE, while no
 * attempt exists and no clock is running. The attempt is only created when the
 * candidate presses Start, so nothing they do while setting up can be recorded
 * as a violation.
 */
const StatusRow = ({ icon: Icon, title, description, status, action }) => {
  const tone =
    status === "granted"
      ? { ring: "border-gdg-green/40 bg-gdg-green/[0.06]", icon: "text-gdg-green" }
      : status === "denied"
        ? { ring: "border-gdg-red/40 bg-gdg-red/[0.06]", icon: "text-gdg-red" }
        : status === "missing"
          ? { ring: "border-gdg-yellow/50 bg-gdg-yellow/10", icon: "text-[#8a6100]" }
          : { ring: "border-line bg-surface", icon: "text-ink-subtle" }

  return (
    <li className={`flex items-start gap-3.5 rounded-xl border p-4 transition-colors ${tone.ring}`}>
      <Icon className={`mt-0.5 size-5 shrink-0 ${tone.icon}`} aria-hidden="true" />

      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{description}</p>
        {action}
      </div>

      <span className="mt-0.5 shrink-0" aria-hidden="true">
        {status === "granted" ? (
          <span className="grid size-6 place-items-center rounded-full bg-gdg-green text-white">
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        ) : status === "denied" ? (
          <span className="grid size-6 place-items-center rounded-full bg-gdg-red text-white">
            <X className="size-3.5" strokeWidth={3} />
          </span>
        ) : status === "missing" ? (
          <span className="grid size-6 place-items-center rounded-full bg-gdg-yellow text-white text-xs font-bold">
            !
          </span>
        ) : (
          <span className="block size-6 animate-pulse rounded-full bg-line" />
        )}
      </span>

      <span className="sr-only">
        {status === "granted" ? "ready" : status === "pending" ? "checking" : "needs attention"}
      </span>
    </li>
  )
}

const SystemCheckPage = () => {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const videoRef = useRef(null)
  const media = useMediaCheck({ enabled: true })

  const [connection, setConnection] = useState("pending")
  const [fullscreen, setFullscreen] = useState(() => isFullscreen())
  const [starting, setStarting] = useState(false)

  const fullscreenSupported = isFullscreenSupported()

  // Attach the preview once the stream exists.
  useEffect(() => {
    const stream = media.stream.current
    if (stream && videoRef.current) videoRef.current.srcObject = stream
  }, [media.camera, media.stream])

  // Connection check against the API the test will actually use.
  const checkConnection = useCallback(async () => {
    setConnection("pending")
    try {
      await api.verify()
      setConnection("granted")
    } catch (error) {
      setConnection(error.status === 401 || error.status === 403 ? "denied" : "missing")
    }
  }, [])

  useEffect(() => {
    checkConnection()
  }, [checkConnection])

  useEffect(() => onFullscreenChange(setFullscreen), [])

  const handleStart = async () => {
    if (starting) return
    setStarting(true)

    // Fullscreen must be requested from this click - it is the user gesture.
    if (fullscreenSupported && !isFullscreen()) await enterFullscreen()

    try {
      // The clock starts HERE, once every check is behind the candidate.
      await api.startQuiz()

      // Hand the camera back so the test page can open its own stream without
      // a second prompt; the permission is already granted for this origin.
      media.release()

      navigate("/test", { replace: true })
    } catch (error) {
      if (/already submitted/i.test(error.message)) {
        navigate("/submitted", { replace: true })
        return
      }
      toast.error(error.message)
      setStarting(false)
    }
  }

  const cameraReady = media.camera === "granted"
  const blocked = media.camera === "denied"

  return (
    <div className="min-h-dvh bg-canvas">
      <Navbar user={user} showSignOut={false} />

      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-subtle">
            Step 2 of 2
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">System check</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-muted">
            Let us get your setup sorted before the clock starts. Nothing here is timed, and
            nothing you do on this screen is recorded against you.
          </p>
        </motion.div>

        <div className="gdg-card mt-8 overflow-hidden">
          <BrandRule />

          <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto]">
            <ul className="space-y-3">
              <StatusRow
                icon={Camera}
                title="Camera"
                status={media.camera}
                description={
                  cameraReady
                    ? "Your camera is on and visible to you only."
                    : media.camera === "denied"
                      ? "Access was blocked. Allow the camera in your browser, then check again."
                      : media.camera === "missing"
                        ? "No camera found. You can continue, and the organisers will see it was unavailable."
                        : "Waiting for permission..."
                }
              />

              <StatusRow
                icon={Mic}
                title="Microphone"
                status={media.microphone}
                description={
                  media.microphone === "granted"
                    ? "Your microphone is on. Speak to see the level move."
                    : media.microphone === "denied"
                      ? "Access was blocked. Allow the microphone, then check again."
                      : media.microphone === "missing"
                        ? "No microphone found. You can still take the test."
                        : "Waiting for permission..."
                }
                action={
                  media.microphone === "granted" ? (
                    <div
                      className="mt-2 h-1.5 w-32 overflow-hidden rounded-full bg-canvas"
                      role="meter"
                      aria-label="Microphone level"
                    >
                      <div
                        className="h-full rounded-full bg-gdg-green transition-[width] duration-75"
                        style={{ width: `${Math.round(media.level * 100)}%` }}
                      />
                    </div>
                  ) : null
                }
              />

              <StatusRow
                icon={Maximize}
                title="Fullscreen"
                status={fullscreen ? "granted" : fullscreenSupported ? "pending" : "missing"}
                description={
                  fullscreen
                    ? "You are in fullscreen."
                    : fullscreenSupported
                      ? "The test opens in fullscreen when you press Start."
                      : "Your browser does not support fullscreen. You can continue."
                }
              />

              <StatusRow
                icon={Wifi}
                title="Connection"
                status={connection}
                description={
                  connection === "granted"
                    ? "Connected to the assessment server."
                    : connection === "denied"
                      ? "Your session expired. Sign in again."
                      : connection === "missing"
                        ? "Cannot reach the server. Check your internet, then try again."
                        : "Checking..."
                }
              />
            </ul>

            {/* Preview */}
            <div className="sm:w-52">
              <div className="overflow-hidden rounded-xl border border-line bg-ink">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  aria-label="Your camera preview"
                  className="aspect-4/3 w-full object-cover"
                />
              </div>
              <p className="mt-2 text-[11px] leading-snug text-ink-subtle">
                This preview is local to your device. Nothing is recorded or uploaded.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-line p-6 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => {
                media.request()
                checkConnection()
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink-muted transition hover:bg-canvas hover:text-ink"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Check again
            </button>

            <button
              type="button"
              onClick={handleStart}
              disabled={starting || connection !== "granted"}
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-gdg-blue px-7 py-3 text-[15px] font-semibold text-white transition hover:bg-gdg-blue-dark disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-subtle"
            >
              {starting ? "Starting..." : "Start test"}
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        {blocked && (
          <p className="mt-4 rounded-xl border border-gdg-yellow/40 bg-gdg-yellow/10 p-4 text-sm leading-relaxed text-[#7a5600]">
            You can still start with the camera blocked, but the organisers will see that
            monitoring was off for your attempt. To allow it, click the camera icon in your
            browser&apos;s address bar and choose Allow, then press Check again.
          </p>
        )}

        <p className="mt-6 text-center text-xs text-ink-subtle">
          Your timer starts only when you press Start test.
        </p>
      </main>
    </div>
  )
}

export default SystemCheckPage
