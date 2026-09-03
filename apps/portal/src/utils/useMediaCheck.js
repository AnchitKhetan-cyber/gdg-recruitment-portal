import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Acquires the camera and microphone, and reports the state of each.
 *
 * Both are requested together so the browser shows one permission prompt
 * instead of two. The prompt is deliberately raised on the system-check screen,
 * before the attempt exists: granting permission steals window focus, and if
 * that happened after the clock started it would be logged as a tab-switch
 * violation the candidate did nothing to earn.
 *
 * The microphone is opened so the candidate can see it is live, and its level
 * is metered locally for that feedback. No audio is analysed, recorded, or
 * transmitted.
 */
export const useMediaCheck = ({ enabled = true } = {}) => {
  const [camera, setCamera] = useState("pending") // pending | granted | denied | missing
  const [microphone, setMicrophone] = useState("pending")
  const [level, setLevel] = useState(0)

  const streamRef = useRef(null)
  const audioContextRef = useRef(null)
  const rafRef = useRef(null)

  /** Meters microphone loudness purely so the candidate sees it working. */
  const startMeter = useCallback((stream) => {
    const AudioContextImpl = window.AudioContext || window.webkitAudioContext
    if (!AudioContextImpl) return

    try {
      const context = new AudioContextImpl()
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 512

      source.connect(analyser)
      audioContextRef.current = context

      const buffer = new Uint8Array(analyser.frequencyBinCount)

      const sample = () => {
        analyser.getByteTimeDomainData(buffer)

        // Deviation from the 128 midpoint, as a rough loudness proxy.
        let peak = 0
        for (const value of buffer) peak = Math.max(peak, Math.abs(value - 128))

        setLevel(Math.min(1, peak / 64))
        rafRef.current = requestAnimationFrame(sample)
      }

      sample()
    } catch {
      // Metering is cosmetic; losing it must not affect the check.
    }
  }, [])

  const release = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null

    audioContextRef.current?.close?.().catch(() => {})
    audioContextRef.current = null

    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const request = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera("missing")
      setMicrophone("missing")
      return null
    }

    setCamera("pending")
    setMicrophone("pending")

    // One combined prompt first. If the candidate has only one device, this
    // fails wholesale, so fall back to asking for each separately rather than
    // reporting both as denied.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
        audio: true
      })

      streamRef.current = stream
      setCamera(stream.getVideoTracks().length ? "granted" : "missing")
      setMicrophone(stream.getAudioTracks().length ? "granted" : "missing")

      if (stream.getAudioTracks().length) startMeter(stream)
      return stream
    } catch (combinedError) {
      const denied = combinedError?.name === "NotAllowedError"

      let videoStream = null
      try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true })
        streamRef.current = videoStream
        setCamera("granted")
      } catch (error) {
        setCamera(error?.name === "NotAllowedError" || denied ? "denied" : "missing")
      }

      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        setMicrophone("granted")
        startMeter(audioStream)

        // Fold the audio track into the retained stream so one release cleans up.
        if (videoStream) audioStream.getAudioTracks().forEach((t) => videoStream.addTrack(t))
        else streamRef.current = audioStream
      } catch (error) {
        setMicrophone(error?.name === "NotAllowedError" || denied ? "denied" : "missing")
      }

      return streamRef.current
    }
  }, [startMeter])

  useEffect(() => {
    if (enabled) request()
    return release
  }, [enabled, request, release])

  return {
    camera,
    microphone,
    level,
    stream: streamRef,
    request,
    release
  }
}
