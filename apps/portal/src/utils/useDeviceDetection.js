import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Watches the candidate's webcam for phones, screens, and extra people.
 *
 * This is a DETERRENT, not a verdict. COCO-SSD is a general-purpose object
 * detector: it confuses a dark remote for a phone, misses a phone held low, and
 * loses a person who leans out of frame. Everything here is reported as an
 * advisory flag that the server records for a human to review - it never counts
 * toward the auto-submit limit. Treating a model guess as proof of cheating
 * would fail honest candidates.
 *
 * Cost is kept low deliberately: one inference every few seconds on a small
 * model, not per frame, because this runs on whatever laptop the candidate has.
 */

/** COCO classes that matter, mapped to the flag they raise. */
const WATCHED = {
  "cell phone": { type: "device-detected", label: "phone" },
  laptop: { type: "device-detected", label: "laptop" },
  tv: { type: "device-detected", label: "monitor or TV" },
  remote: { type: "device-detected", label: "remote-like object" },
  book: { type: "device-detected", label: "book or notes" }
}

const DETECT_INTERVAL_MS = 4000
// A single frame is not evidence: the same finding must recur before it counts.
const CONSECUTIVE_HITS_REQUIRED = 2
const MIN_CONFIDENCE = 0.6
// Do not re-report the same finding more often than this.
const REPORT_COOLDOWN_MS = 25_000

export const useDeviceDetection = ({ active, videoRef, onFlag }) => {
  const [state, setState] = useState("idle") // idle | loading | running | unavailable
  const [lastFinding, setLastFinding] = useState(null)

  const modelRef = useRef(null)
  const streakRef = useRef({})
  const lastReportRef = useRef({})
  const onFlagRef = useRef(onFlag)

  useEffect(() => {
    onFlagRef.current = onFlag
  }, [onFlag])

  /** Reports a finding, rate-limited per finding type. */
  const report = useCallback((type, detail, confidence) => {
    const now = Date.now()
    const key = `${type}:${detail}`

    if (now - (lastReportRef.current[key] || 0) < REPORT_COOLDOWN_MS) return
    lastReportRef.current[key] = now

    setLastFinding({ detail, at: now })
    onFlagRef.current?.({ type, detail, confidence })
  }, [])

  // Load the model lazily so it never delays sign-in or the first question.
  useEffect(() => {
    if (!active) return undefined

    let cancelled = false

    const load = async () => {
      setState("loading")

      try {
        const [tf, cocoSsd] = await Promise.all([
          import("@tensorflow/tfjs"),
          import("@tensorflow-models/coco-ssd")
        ])

        await tf.ready()

        // lite_mobilenet_v2 is the smallest and fastest variant; accuracy is
        // adequate for "is there a phone in shot" and the CPU cost is bearable
        // on a mid-range laptop that is also running a timed test.
        const model = await cocoSsd.load({ base: "lite_mobilenet_v2" })

        if (cancelled) {
          model.dispose?.()
          return
        }

        modelRef.current = model
        setState("running")
      } catch (error) {
        // A blocked CDN, no WebGL, or an unsupported browser. The test must
        // continue regardless - detection is a bonus, not a gate.
        console.warn("[proctor] object detection unavailable:", error?.message)
        if (!cancelled) setState("unavailable")
      }
    }

    load()

    return () => {
      cancelled = true
      modelRef.current?.dispose?.()
      modelRef.current = null
    }
  }, [active])

  // Inference loop.
  useEffect(() => {
    if (!active || state !== "running") return undefined

    let timer = null
    let stopped = false

    const tick = async () => {
      const video = videoRef.current
      const model = modelRef.current

      // readyState < 2 means no frame is available yet.
      if (!stopped && model && video && video.readyState >= 2 && video.videoWidth > 0) {
        try {
          const predictions = await model.detect(video, 10, MIN_CONFIDENCE)

          const seen = new Set()
          let people = 0

          for (const prediction of predictions) {
            if (prediction.class === "person") {
              people += 1
              continue
            }

            const watched = WATCHED[prediction.class]
            if (watched) seen.add(`${watched.type}|${watched.label}|${prediction.score.toFixed(2)}`)
          }

          // Objects: require the same class on consecutive passes.
          const currentLabels = new Set([...seen].map((s) => s.split("|")[1]))

          for (const entry of seen) {
            const [type, label, score] = entry.split("|")
            streakRef.current[label] = (streakRef.current[label] || 0) + 1

            if (streakRef.current[label] >= CONSECUTIVE_HITS_REQUIRED) {
              report(type, label, Number(score))
            }
          }

          // Reset the streak for anything no longer in frame.
          for (const label of Object.keys(streakRef.current)) {
            if (!currentLabels.has(label)) streakRef.current[label] = 0
          }

          // People: more than one is the strongest signal this detector gives.
          if (people > 1) {
            streakRef.current.__people = (streakRef.current.__people || 0) + 1
            if (streakRef.current.__people >= CONSECUTIVE_HITS_REQUIRED) {
              report("multiple-people", `${people} people in frame`, 0.9)
            }
          } else {
            streakRef.current.__people = 0
          }

          // Nobody in frame for several passes running.
          if (people === 0) {
            streakRef.current.__absent = (streakRef.current.__absent || 0) + 1
            if (streakRef.current.__absent >= 3) {
              report("no-person", "candidate not visible", 0.8)
              streakRef.current.__absent = 0
            }
          } else {
            streakRef.current.__absent = 0
          }
        } catch {
          // A transient inference failure is not worth surfacing; try again.
        }
      }

      if (!stopped) timer = setTimeout(tick, DETECT_INTERVAL_MS)
    }

    timer = setTimeout(tick, DETECT_INTERVAL_MS)

    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
  }, [active, state, videoRef, report])

  return { state, lastFinding }
}
