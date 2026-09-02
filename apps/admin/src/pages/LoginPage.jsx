import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { AlertCircle, KeyRound } from "lucide-react"
import { toast } from "sonner"
import { useAdminStore } from "../store/admin.store"
import { Button, Card, GdgMark, Input } from "../components/ui"

const LoginPage = () => {
  const navigate = useNavigate()
  const login = useAdminStore((s) => s.login)

  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!password.trim()) return

    setLoading(true)
    setError("")

    try {
      await login(password)
      toast.success("Signed in")
      navigate("/dashboard", { replace: true })
    } catch (err) {
      setError(err.message)
      setPassword("")
    } finally {
      setLoading(false)
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

        <form onSubmit={handleSubmit} className="p-7">
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
            Enter the organiser password to manage tests, candidates, and results.
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

          <Input
            id="admin-password"
            label="Password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••••••"
            className="mt-5"
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            disabled={!password.trim()}
            className="mt-5 w-full"
          >
            <KeyRound className="size-4" aria-hidden="true" />
            {loading ? "Checking..." : "Sign in"}
          </Button>

          <p className="mt-5 text-center text-[11px] text-ink-subtle">
            This panel is not indexed and is rate limited to 10 attempts per 15 minutes.
          </p>
        </form>
      </Card>
    </main>
  )
}

export default LoginPage
