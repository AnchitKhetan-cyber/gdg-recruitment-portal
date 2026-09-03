import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Camera, CameraOff, ChevronDown, Mic, ScanEye } from "lucide-react"
import { useDeviceDetection } from "../utils/useDeviceDetection"

/**
 * The candidate's camera preview, plus on-device object detection.
 *
 * The video never leaves the browser: frames are analysed locally and only the
 * resulting flag - a label and a confidence - is sent to the server. Nothing is
 * recorded or uploaded.
 */
const ProctorCamera = ({ active = true, onFlag }) => {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [state, setState] = useState("starting") // starting | live | denied | unavailable
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    let cancelled = false

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("unavailable")
        return
      }

      try {
        // Audio is requested too, so the microphone light stays on for the
        // duration. Permission was already granted on the system-check screen,
        // so this does not prompt again. Nothing is recorded.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: "user" },
          audio: true
        })

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setState("live")
      } catch (error) {
        setState(error?.name === "NotAllowedError" ? "denied" : "unavailable")
      }
    }

    start()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  const detection = useDeviceDetection({
    active: active && state === "live",
    videoRef,
    onFlag
  })

  if (state === "denied" || state === "unavailable") {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-gdg-yellow/40 bg-gdg-yellow/10 p-3 text-xs text-[#7a5600]">
        <CameraOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>
          {state === "denied"
            ? "Camera access was blocked. Your test continues, but the organisers can see that monitoring was off."
            : "No camera detected on this device."}
        </p>
      </div>
    )
  }

  const recentFinding = detection.lastFinding && Date.now() - detection.lastFinding.at < 12_000

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-ink-muted transition hover:bg-canvas"
      >
        <span className="relative flex size-2" aria-hidden="true">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-gdg-red/60" />
          <span className="relative inline-flex size-2 rounded-full bg-gdg-red" />
        </span>
        <Camera className="size-3.5" aria-hidden="true" />
        Monitoring active
        <ChevronDown
          className={`ml-auto size-4 transition-transform ${collapsed ? "-rotate-90" : ""}`}
          aria-hidden="true"
        />
      </button>

      <div className={collapsed ? "hidden" : "block"}>
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            aria-label="Your camera preview"
            className="aspect-4/3 w-full bg-ink object-cover"
          />

          {recentFinding && (
            <div
              role="status"
              className="absolute inset-x-0 bottom-0 flex items-start gap-1.5 bg-gdg-red/90 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-white"
            >
              <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden="true" />
              <span>Possible {detection.lastFinding.detail} in view - this was flagged</span>
            </div>
          )}
        </div>

        <div className="px-3 py-2">
          {detection.state === "loading" && (
            <p className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
              <ScanEye className="size-3 animate-pulse" aria-hidden="true" />
              Starting object detection...
            </p>
          )}

          {detection.state === "running" && (
            <p className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
              <ScanEye className="size-3 text-gdg-green" aria-hidden="true" />
              Scanning for phones and other people
            </p>
          )}

          {detection.state === "mock" && (
            <p className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
              <Mic className="size-3 text-gdg-green" aria-hidden="true" />
              Camera and microphone are on
            </p>
          )}

          <p className="mt-1 text-[11px] leading-snug text-ink-subtle">
            {detection.state === "mock"
              ? "Nothing is recorded or uploaded."
              : "Analysed on your device. No video is recorded or uploaded."}
          </p>
        </div>
      </div>
    </div>
  )
}

export default ProctorCamera
