import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { AlertCircle, KeyRound, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useAdminStore } from "../store/admin.store"
import { isFirebaseConfigured, signInWithGoogle } from "../utils/firebase"
import { Button, Card, GdgMark, Input } from "../components/ui"

const GoogleGlyph = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path
      fill="#4285F4"
      d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
    />
    <path
      fill="#34A853"
      d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
    />
    <path
      fill="#FBBC04"
      d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
    />
    <path
      fill="#EA4335"
      d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
    />
  </svg>
)

const LoginPage = () => {
  const navigate = useNavigate()
  const loginWithGoogle = useAdminStore((s) => s.loginWithGoogle)
  const login = useAdminStore((s) => s.login)

  const [error, setError] = useState("")
  const [googleLoading, setGoogleLoading] = useState(false)

  // Password is a break-glass fallback, hidden by default so Google is the path.
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState("")
  const [pwLoading, setPwLoading] = useState(false)

  const done = () => {
    toast.success("Signed in")
    navigate("/dashboard", { replace: true })
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    setError("")
    try {
      const { idToken } = await signInWithGoogle()
      await loginWithGoogle(idToken)
      done()
    } catch (err) {
      setError(err.message)
      if (!/cancelled/i.test(err.message)) toast.error(err.message)
    } finally {
      setGoogleLoading(false)
    }
  }

  const handlePassword = async (event) => {
    event.preventDefault()
    if (!password.trim()) return
    setPwLoading(true)
    setError("")
    try {
      await login(password)
      done()
    } catch (err) {
      setError(err.message)
      setPassword("")
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-20 -top-20 size-96 rounded-full bg-gdg-blue/10 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 size-96 rounded-full bg-gdg-green/10 blur-3xl" />
      </div>

      <Card className="w-full max-w-sm overflow-hidden">
        <div className="gdg-rule h-1" aria-hidden="true" />

        <div className="p-7">
          <div className="flex items-center gap-3">
            <GdgMark size={32} />
            <div className="leading-tight">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-subtle">
                GDG Recruitment
              </p>
              <h1 className="text-lg font-semibold text-ink">Admin panel</h1>
            </div>
          </div>

          <p className="mt-5 text-sm text-ink-muted">
            Sign in with an authorised Google account to manage tests, candidates, and results.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-lg border border-gdg-red/30 bg-gdg-red/[0.07] p-3 text-sm text-gdg-red"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}

          {isFirebaseConfigured ? (
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink shadow-[var(--shadow-card)] transition hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60"
            >
              {googleLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Signing in...
                </>
              ) : (
                <>
                  <GoogleGlyph size={18} />
                  Continue with Google
                </>
              )}
            </button>
          ) : (
            <div className="mt-6 rounded-lg border border-gdg-yellow/40 bg-gdg-yellow/10 p-3 text-sm text-[#7a5600]">
              Google sign-in is not configured. Add the Firebase web config to{" "}
              <code className="font-mono text-xs">apps/admin/.env</code>.
            </div>
          )}

          {/* Break-glass password fallback */}
          {showPassword ? (
            <form onSubmit={handlePassword} className="mt-5 border-t border-line pt-5">
              <Input
                id="admin-password"
                label="Organiser password"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••••••"
              />
              <Button
                type="submit"
                variant="secondary"
                loading={pwLoading}
                disabled={!password.trim()}
                className="mt-3 w-full"
              >
                <KeyRound className="size-4" aria-hidden="true" />
                {pwLoading ? "Checking..." : "Sign in with password"}
              </Button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowPassword(true)}
              className="mt-4 w-full text-center text-xs text-ink-subtle hover:text-ink"
            >
              Use the organiser password instead
            </button>
          )}

          <p className="mt-5 text-center text-[11px] text-ink-subtle">
            Only authorised organiser accounts can enter. Rate limited to 10 attempts / 15 min.
          </p>
        </div>
      </Card>
    </main>
  )
}

export default LoginPage
