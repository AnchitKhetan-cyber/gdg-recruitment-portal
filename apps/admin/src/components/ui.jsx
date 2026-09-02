import { Loader2 } from "lucide-react"

/* Small shared primitives, kept in one file so the admin pages stay readable. */

export const GdgMark = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <circle cx="11" cy="11" r="4.5" fill="#4285F4" />
    <circle cx="21" cy="11" r="4.5" fill="#EA4335" />
    <circle cx="11" cy="21" r="4.5" fill="#FBBC04" />
    <circle cx="21" cy="21" r="4.5" fill="#34A853" />
  </svg>
)

const VARIANTS = {
  primary: "bg-gdg-blue text-white hover:bg-gdg-blue-dark disabled:bg-line disabled:text-ink-subtle",
  secondary: "border border-line bg-surface text-ink hover:bg-canvas",
  ghost: "text-ink-muted hover:bg-canvas hover:text-ink",
  danger: "border border-gdg-red/30 bg-gdg-red/[0.06] text-gdg-red hover:bg-gdg-red/10",
  success: "bg-gdg-green text-white hover:brightness-95"
}

const SIZES = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-2.5 text-sm"
}

export const Button = ({
  variant = "secondary",
  size = "md",
  loading = false,
  className = "",
  children,
  ...props
}) => (
  <button
    type="button"
    disabled={loading || props.disabled}
    {...props}
    className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
  >
    {loading && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
    {children}
  </button>
)

export const Card = ({ className = "", children }) => (
  <div className={`rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)] ${className}`}>
    {children}
  </div>
)

export const Input = ({ label, hint, error, className = "", id, ...props }) => (
  <div className={className}>
    {label && (
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-ink-muted">
        {label}
      </label>
    )}
    <input
      id={id}
      {...props}
      aria-invalid={error ? "true" : undefined}
      className={`w-full rounded-lg border bg-surface px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-subtle focus:border-gdg-blue ${
        error ? "border-gdg-red" : "border-line"
      }`}
    />
    {error ? (
      <p className="mt-1 text-xs text-gdg-red">{error}</p>
    ) : hint ? (
      <p className="mt-1 text-xs text-ink-subtle">{hint}</p>
    ) : null}
  </div>
)

export const Select = ({ label, className = "", id, children, ...props }) => (
  <div className={className}>
    {label && (
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-ink-muted">
        {label}
      </label>
    )}
    <select
      id={id}
      {...props}
      className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-gdg-blue"
    >
      {children}
    </select>
  </div>
)

const BADGE_TONES = {
  neutral: "border-line bg-canvas text-ink-muted",
  blue: "border-gdg-blue/30 bg-gdg-blue/10 text-gdg-blue-dark",
  green: "border-gdg-green/30 bg-gdg-green/10 text-[#1b7a3d]",
  yellow: "border-gdg-yellow/40 bg-gdg-yellow/10 text-[#8a6100]",
  red: "border-gdg-red/30 bg-gdg-red/[0.08] text-gdg-red"
}

export const Badge = ({ tone = "neutral", children, className = "" }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${BADGE_TONES[tone]} ${className}`}
  >
    {children}
  </span>
)

export const Spinner = ({ label = "Loading" }) => (
  <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-muted" role="status">
    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
    {label}...
  </div>
)

export const EmptyState = ({ icon: Icon, title, body, action }) => (
  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
    {Icon && <Icon className="size-8 text-ink-subtle" aria-hidden="true" strokeWidth={1.5} />}
    <h3 className="mt-3 text-sm font-semibold text-ink">{title}</h3>
    {body && <p className="mt-1 max-w-sm text-sm text-ink-muted">{body}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
)

/** Formats seconds as mm:ss for the results table. */
export const formatDuration = (seconds) => {
  const safe = Math.max(0, Math.floor(seconds || 0))
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`
}

export const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "-"

/** Status pill shared by the results table and the detail page. */
export const StatusBadge = ({ user }) => {
  if (user.hasSubmitted) return <Badge tone="green">Submitted</Badge>
  if (user.hasStarted) return <Badge tone="yellow">In progress</Badge>
  return <Badge tone="neutral">Not started</Badge>
}
