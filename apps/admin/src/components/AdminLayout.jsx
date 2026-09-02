import { useState } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { BarChart3, FileQuestion, LogOut, Menu, UserCheck, Users, X } from "lucide-react"
import { toast } from "sonner"
import { useAdminStore } from "../store/admin.store"
import { GdgMark } from "./ui"

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/results", label: "Results", icon: UserCheck },
  { to: "/quizzes", label: "Tests", icon: FileQuestion },
  { to: "/candidates", label: "Whitelist", icon: Users }
]

/** Shell for every authenticated admin page: sidebar on desktop, drawer on mobile. */
const AdminLayout = () => {
  const navigate = useNavigate()
  const logout = useAdminStore((s) => s.logout)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    toast.success("Signed out")
    navigate("/login", { replace: true })
  }

  const navLinks = (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={() => setDrawerOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              isActive
                ? "bg-gdg-blue/10 text-gdg-blue-dark"
                : "text-ink-muted hover:bg-canvas hover:text-ink"
            }`
          }
        >
          <item.icon className="size-4.5" aria-hidden="true" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <GdgMark size={22} />
        <p className="text-sm font-semibold text-ink">GDG Admin</p>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-line bg-surface p-4">
            <div className="mb-6 flex items-center gap-2.5">
              <GdgMark size={24} />
              <p className="text-sm font-semibold text-ink">GDG Admin</p>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
                className="ml-auto rounded-lg p-1.5 text-ink-muted hover:bg-canvas"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            {navLinks}
          </div>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-[100rem]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface p-4 lg:flex">
          <div className="mb-7 flex items-center gap-2.5 px-2 pt-2">
            <GdgMark size={26} />
            <div className="leading-tight">
              <p className="text-sm font-semibold text-ink">GDG Admin</p>
              <p className="text-[11px] text-ink-subtle">Recruitment</p>
            </div>
          </div>

          {navLinks}

          <button
            type="button"
            onClick={handleLogout}
            className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-muted transition hover:bg-canvas hover:text-gdg-red"
          >
            <LogOut className="size-4.5" aria-hidden="true" />
            Sign out
          </button>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
