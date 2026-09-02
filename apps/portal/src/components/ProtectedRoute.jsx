import { useEffect, useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { api } from "../api/client"
import { useAuthStore } from "../store/auth.store"
import Loading from "./Loading"

/**
 * Route guard.
 *
 * The persisted store is never trusted on its own - each guarded entry
 * re-verifies the httpOnly session against the server before rendering.
 */
const ProtectedRoute = ({ children }) => {
  const [state, setState] = useState("checking") // checking | allowed | denied
  const setUser = useAuthStore((s) => s.setUser)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const location = useLocation()

  useEffect(() => {
    let cancelled = false

    api
      .verify()
      .then((data) => {
        if (cancelled) return
        setUser(data.user)
        setState("allowed")
      })
      .catch(() => {
        if (cancelled) return
        clearAuth()
        setState("denied")
      })

    return () => {
      cancelled = true
    }
  }, [setUser, clearAuth])

  if (state === "checking") return <Loading label="Verifying your session" />
  if (state === "denied") return <Navigate to="/" replace state={{ from: location.pathname }} />

  return children
}

export default ProtectedRoute
