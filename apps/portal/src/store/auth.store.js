import { create } from "zustand"
import { persist } from "zustand/middleware"

const emptyUser = { uid: "", name: "", email: "", hasStarted: false, hasSubmitted: false }

/**
 * Caches the signed-in candidate for instant paint on reload.
 *
 * This is a convenience only - the httpOnly session cookie is the real
 * credential, and every guarded route still re-verifies it against the server.
 */
export const useAuthStore = create(
  persist(
    (set) => ({
      user: emptyUser,
      isAuthenticated: false,

      setUser: (user) => set({ user: { ...emptyUser, ...user }, isAuthenticated: true }),

      clearAuth: () => set({ user: emptyUser, isAuthenticated: false })
    }),
    {
      name: "gdg-portal-auth",
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated })
    }
  )
)
