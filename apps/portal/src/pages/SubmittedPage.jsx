import { useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { CheckCircle2, Clock, ShieldAlert } from "lucide-react"
import { api } from "../api/client"
import { useAuthStore } from "../store/auth.store"
import { signOutFromGoogle } from "../utils/firebase"
import { BrandRule, GdgMark } from "../components/Brand"

const VARIANTS = {
  manual: {
    icon: CheckCircle2,
    accent: "text-gdg-green",
    title: "Your test has been submitted",
    body: "Thank you for taking the time. Your answers are recorded and the round is closed for you."
  },
  "time-expired": {
    icon: Clock,
    accent: "text-gdg-yellow",
    title: "Time is up - your answers were submitted",
    body: "The clock ran out, so everything you had answered was submitted automatically. Nothing was lost."
  },
  "violations-exceeded": {
    icon: ShieldAlert,
    accent: "text-gdg-red",
    title: "Your test was submitted early",
    body: "You left the test tab more times than the rules allow, so the attempt was closed and submitted. The core team will review the flag."
  }
}

const SubmittedPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const reason = location.state?.reason || "manual"
  const variant = VARIANTS[reason] || VARIANTS.manual
  const Icon = variant.icon

  // The session is finished; close it so a stale cookie cannot be reused.
  useEffect(() => {
    let cancelled = false

    const finish = async () => {
      await api.logout().catch(() => {})
      await signOutFromGoogle()
      if (!cancelled) clearAuth()
    }

    finish()
    return () => {
      cancelled = true
    }
  }, [clearAuth])

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-canvas">
        <div className="absolute -left-20 top-10 size-[22rem] rounded-full bg-gdg-green/10 blur-3xl" />
        <div className="absolute -right-20 bottom-10 size-[22rem] rounded-full bg-gdg-blue/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-lg"
      >
        <div className="gdg-card overflow-hidden text-center">
          <BrandRule />

          <div className="px-7 py-10 sm:px-10">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.12, type: "spring", stiffness: 200, damping: 16 }}
            >
              <Icon className={`mx-auto size-14 ${variant.accent}`} aria-hidden="true" strokeWidth={1.5} />
            </motion.div>

            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">{variant.title}</h1>
            <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink-muted">
              {variant.body}
            </p>

            <div className="mt-7 rounded-xl border border-line bg-canvas p-4 text-left">
              <h2 className="text-sm font-semibold text-ink">What happens next</h2>
              <ol className="mt-2.5 space-y-2 text-sm leading-relaxed text-ink-muted">
                <li className="flex gap-2.5">
                  <span className="font-mono text-xs text-ink-subtle">01</span>
                  The core team reviews every submission.
                </li>
                <li className="flex gap-2.5">
                  <span className="font-mono text-xs text-ink-subtle">02</span>
                  Shortlisted candidates are emailed about the interview round.
                </li>
                <li className="flex gap-2.5">
                  <span className="font-mono text-xs text-ink-subtle">03</span>
                  Watch the address you signed in with, including the spam folder.
                </li>
              </ol>
            </div>

            <p className="mt-6 text-xs text-ink-subtle">
              Scores are not shared with candidates. You can safely close this tab.
            </p>

            <button
              type="button"
              onClick={() => navigate("/", { replace: true })}
              className="mt-6 rounded-full border border-line px-6 py-2.5 text-sm font-medium text-ink-muted transition hover:bg-canvas hover:text-ink"
            >
              Back to sign in
            </button>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-ink-subtle">
          <GdgMark size={16} />
          Google Developer Groups
        </div>
      </motion.div>
    </main>
  )
}

export default SubmittedPage
