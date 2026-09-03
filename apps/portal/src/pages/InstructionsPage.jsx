import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowRight,
  Camera,
  Clock,
  Maximize,
  MonitorSmartphone,
  RefreshCw,
  ShieldAlert,
  Wifi
} from "lucide-react"
import { api } from "../api/client"
import { useAuthStore } from "../store/auth.store"
import { signOutFromGoogle } from "../utils/firebase"
import Navbar from "../components/Navbar"
import { BrandRule } from "../components/Brand"

const RULES = [
  {
    icon: Clock,
    accent: "text-gdg-blue",
    title: "The clock runs on our server",
    body: "Your remaining time is tracked server-side. Refreshing, closing the tab, or switching devices will not give you extra time."
  },
  {
    icon: RefreshCw,
    accent: "text-gdg-green",
    title: "Your answers are saved as you go",
    body: "Every answer is saved automatically. If your browser crashes, sign back in and you will resume the same paper exactly where you left it."
  },
  {
    icon: Maximize,
    accent: "text-gdg-red",
    title: "The test runs in fullscreen",
    body: "The paper opens in fullscreen. If you leave it, your questions are hidden until you return, the clock keeps running, and the exit is recorded."
  },
  {
    icon: ShieldAlert,
    accent: "text-gdg-red",
    title: "Leaving the tab is recorded",
    body: "Switching tabs or windows is logged. After a few such events your test is submitted automatically and the round ends for you."
  },
  {
    icon: Camera,
    accent: "text-gdg-yellow",
    title: "Camera and microphone stay on",
    body: "Your camera and microphone stay on for the duration of the test. Both run locally on your device — nothing is recorded, uploaded, or listened to."
  },
  {
    icon: Wifi,
    accent: "text-gdg-blue",
    title: "Stay on a stable connection",
    body: "A brief drop is fine because answers are retried, but a long outage eats into your time."
  },
  {
    icon: MonitorSmartphone,
    accent: "text-gdg-green",
    title: "Use a laptop or desktop",
    body: "The paper works on a phone, but a larger screen makes the question palette far easier to use."
  }
]

const InstructionsPage = () => {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const [agreed, setAgreed] = useState(false)
  const [isStarting, setIsStarting] = useState(false)

  const handleSignOut = async () => {
    await api.logout().catch(() => {})
    await signOutFromGoogle()
    clearAuth()
    navigate("/", { replace: true })
  }

  // Deliberately does NOT start the attempt. The system check runs first, so
  // the camera prompt and fullscreen switch happen while no clock is running
  // and no proctoring is active - otherwise granting permission steals focus
  // and is logged as a violation the candidate never earned.
  const handleBegin = () => {
    if (!agreed || isStarting) return
    setIsStarting(true)
    navigate("/system-check")
  }

  const isResuming = user.hasStarted && !user.hasSubmitted

  return (
    <div className="min-h-dvh bg-canvas">
      <Navbar user={user} onSignOut={handleSignOut} />

      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-subtle">
            Before you begin
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {isResuming ? "Resume your assessment" : "Assessment instructions"}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
            {isResuming
              ? "You have an attempt in progress. Continuing takes you back to the same paper, with the time you have left."
              : "Read these once. They explain exactly how the test behaves, so nothing surprises you halfway through."}
          </p>
        </motion.div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {RULES.map((rule, index) => (
            <motion.div
              key={rule.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.04 * index }}
              className="gdg-card p-5"
            >
              <rule.icon className={`size-5 ${rule.accent}`} aria-hidden="true" />
              <h2 className="mt-3 text-[15px] font-semibold text-ink">{rule.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{rule.body}</p>
            </motion.div>
          ))}
        </div>

        <section className="gdg-card mt-8 overflow-hidden">
          <BrandRule />
          <div className="p-6">
            <h2 className="text-base font-semibold text-ink">Privacy</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              GDG collects your name, email, and your answers to this test, and uses them only to
              evaluate this recruitment round. Your camera preview is rendered locally in your browser
              and is never uploaded or stored. Records are deleted once the round closes.
            </p>
          </div>
        </section>

        <div className="gdg-card mt-6 flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="mt-0.5 size-4.5 shrink-0 accent-[var(--color-gdg-blue)]"
            />
            <span className="leading-relaxed">
              I have read the instructions and agree to the rules above.
            </span>
          </label>

          <button
            type="button"
            onClick={handleBegin}
            disabled={!agreed || isStarting}
            className="group flex shrink-0 items-center justify-center gap-2 rounded-full bg-gdg-blue px-7 py-3 text-[15px] font-semibold text-white transition hover:bg-gdg-blue-dark disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-subtle"
          >
            {isStarting ? "Opening..." : isResuming ? "Resume test" : "Begin test"}
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>
        </div>

        <p className="mt-8 text-center text-xs text-ink-subtle">
          Made with care by the GDG core team.
        </p>
      </main>
    </div>
  )
}

export default InstructionsPage
