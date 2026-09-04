import { create } from "zustand"
import { api } from "../api/client"

/**
 * Admin session state.
 *
 * Nothing is persisted: the admin cookie is the only credential, and a page
 * reload re-verifies it. This deliberately keeps admin auth out of localStorage.
 */
export const useAdminStore = create((set) => ({
  status: "unknown", // unknown | authenticated | anonymous

  check: async () => {
    try {
      await api.verify()
      set({ status: "authenticated" })
      return true
    } catch {
      set({ status: "anonymous" })
      return false
    }
  },

  login: async (password) => {
    await api.login(password)
    set({ status: "authenticated" })
  },

  loginWithGoogle: async (idToken) => {
    await api.googleLogin(idToken)
    set({ status: "authenticated" })
  },

  logout: async () => {
    await api.logout().catch(() => {})
    set({ status: "anonymous" })
  }
}))
