import { useEffect, useRef, useState } from "react"
import { Camera, CameraOff, ChevronDown } from "lucide-react"

/**
 * The candidate's own camera preview.
 *
 * Nothing is recorded or transmitted - this is a presence cue that keeps the
 * candidate aware they are sitting a monitored assessment. It fails soft: a
 * denied permission shows a notice rather than blocking the test.
 */
const ProctorCamera = () => {
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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: "user" },
          audio: false
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
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-label="Your camera preview"
          className="aspect-4/3 w-full bg-ink object-cover"
        />
        <p className="px-3 py-2 text-[11px] leading-snug text-ink-subtle">
          This preview is local to your device and is not recorded.
        </p>
      </div>
    </div>
  )
}

export default ProctorCamera
