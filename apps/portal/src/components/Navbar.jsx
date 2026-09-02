import { LogOut } from "lucide-react"
import { GdgMark } from "./Brand"

/**
 * The portal header. During a live attempt the sign-out control is withheld, so
 * a candidate cannot end their session by mistake mid-paper.
 */
const Navbar = ({ user, onSignOut, showSignOut = true, right = null }) => (
  <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
    <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <GdgMark size={26} />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-ink">GDG Recruitment</p>
          <p className="truncate text-xs text-ink-subtle">Google Developer Groups</p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {right}

        {user?.email && (
          <div className="hidden text-right leading-tight sm:block">
            <p className="truncate text-sm font-medium text-ink">{user.name}</p>
            <p className="max-w-[14rem] truncate text-xs text-ink-subtle">{user.email}</p>
          </div>
        )}

        {user?.email && (
          <div
            className="grid size-9 shrink-0 place-items-center rounded-full bg-gdg-blue/10 text-sm font-semibold text-gdg-blue-dark"
            aria-hidden="true"
          >
            {user.name?.trim()?.charAt(0)?.toUpperCase() || "?"}
          </div>
        )}

        {showSignOut && user?.email && (
          <button
            type="button"
            onClick={onSignOut}
            className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm font-medium text-ink-muted transition hover:bg-canvas hover:text-ink"
          >
            <LogOut className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        )}
      </div>
    </div>
  </header>
)

export default Navbar
