import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { api } from "../api/client"
import { useAuthStore } from "../store/auth.store"
import { isFirebaseConfigured, signInWithGoogle } from "../utils/firebase"
import { BrandRule, GdgMark, GoogleGlyph } from "../components/Brand"

const SignInPage = () => {
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSignIn = async () => {
    setIsLoading(true)
    setError("")

    try {
      const { idToken } = await signInWithGoogle()
      const data = await api.signIn(idToken)

      setUser(data.user)
      toast.success(`Welcome, ${data.user.name.split(" ")[0]}`)

      navigate(data.user.hasSubmitted ? "/submitted" : "/instructions", { replace: true })
    } catch (err) {
      setError(err.message)
      // A cancelled popup is a deliberate act, not a failure worth a toast.
      if (!/cancelled/i.test(err.message)) toast.error(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      {/* Soft brand wash rather than a photographic background, so the card stays legible. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-canvas">
        <div className="absolute -left-24 -top-24 size-[26rem] rounded-full bg-gdg-blue/12 blur-3xl" />
        <div className="absolute -right-24 top-1/4 size-[22rem] rounded-full bg-gdg-red/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 size-[24rem] rounded-full bg-gdg-green/10 blur-3xl" />
        <div className="absolute -bottom-20 right-1/4 size-[18rem] rounded-full bg-gdg-yellow/12 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="gdg-card overflow-hidden">
          <BrandRule />

          <div className="px-7 py-9 sm:px-9">
            <div className="flex items-center gap-3">
              <GdgMark size={36} />
              <div className="leading-tight">
                <p className="text-xs font-semibold uppercase tracking-widest text-ink-subtle">
                  Google Developer Groups
                </p>
                <h1 className="text-xl font-semibold text-ink">Recruitment Portal</h1>
              </div>
            </div>

            <p className="mt-6 text-[15px] leading-relaxed text-ink-muted">
              Sign in with your <span className="font-medium text-ink">@thapar.edu</span> Google
              account. Every Thapar student is eligible &mdash; no registration needed.
            </p>

            {error && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2.5 rounded-xl border border-gdg-red/30 bg-gdg-red/[0.07] p-3.5 text-sm text-gdg-red"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p>{error}</p>
              </div>
            )}

            {!isFirebaseConfigured && (
              <div
                role="alert"
                className="mt-5 rounded-xl border border-gdg-yellow/40 bg-gdg-yellow/10 p-3.5 text-sm text-[#7a5600]"
              >
                Google sign-in is not configured on this build. Copy{" "}
                <code className="font-mono text-xs">.env.example</code> to{" "}
                <code className="font-mono text-xs">.env</code> and add your Firebase web config.
              </div>
            )}

            <button
              type="button"
              onClick={handleSignIn}
              disabled={isLoading || !isFirebaseConfigured}
              className="mt-7 flex w-full items-center justify-center gap-3 rounded-full border border-line bg-surface px-5 py-3.5 text-[15px] font-semibold text-ink shadow-[var(--shadow-card)] transition hover:bg-canvas hover:shadow-[var(--shadow-lift)] disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                  Signing you in...
                </>
              ) : (
                <>
                  <GoogleGlyph size={20} />
                  Continue with Google
                </>
              )}
            </button>

            <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-ink-subtle">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                We read only your name and email, and use them solely to run this recruitment round.
              </span>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-ink-subtle">
          Trouble signing in? Contact the GDG core team.
        </p>
      </motion.div>
    </main>
  )
}

export default SignInPage
