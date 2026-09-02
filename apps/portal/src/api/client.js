import axios from "axios"

// In development Vite proxies /api to the backend, so a relative base keeps the
// request same-origin. In production VITE_API_URL points at the deployed API.
const baseURL = import.meta.env.DEV
  ? "/api"
  : `${(import.meta.env.VITE_API_URL || "").replace(/\/$/, "")}/api`

const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 20_000,
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest"
  }
})

/**
 * Normalises every failure into an Error carrying the server's message, so call
 * sites can surface something useful instead of "Request failed with status 500".
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ||
      (error.code === "ECONNABORTED"
        ? "The server took too long to respond. Check your connection."
        : null) ||
      (error.request && !error.response
        ? "Cannot reach the server. Check your internet connection."
        : null) ||
      error.message ||
      "Something went wrong"

    const wrapped = new Error(message)
    wrapped.status = error.response?.status
    wrapped.details = error.response?.data?.details
    wrapped.original = error
    return Promise.reject(wrapped)
  }
)

export const api = {
  signIn: (idToken) =>
    apiClient
      .post("/user/firebase-auth", {}, { headers: { Authorization: `Bearer ${idToken}` } })
      .then((r) => r.data),

  verify: () => apiClient.get("/user/verify").then((r) => r.data),

  logout: () => apiClient.get("/user/logout").then((r) => r.data),

  startQuiz: () => apiClient.post("/user/start-quiz", {}).then((r) => r.data),

  saveProgress: (responses) =>
    apiClient.post("/user/save-progress", { responses }).then((r) => r.data),

  reportViolation: (type, extra = {}) =>
    apiClient.post("/user/violation", { type, ...extra }).then((r) => r.data),

  submitQuiz: (responses) => apiClient.post("/user/submit-quiz", { responses }).then((r) => r.data)
}

export default apiClient
