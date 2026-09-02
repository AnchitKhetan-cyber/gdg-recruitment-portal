import axios from "axios"

const baseURL = import.meta.env.DEV
  ? "/api"
  : `${(import.meta.env.VITE_API_URL || "").replace(/\/$/, "")}/api`

const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 30_000,
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest"
  }
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ||
      (error.request && !error.response ? "Cannot reach the API server." : null) ||
      error.message ||
      "Something went wrong"

    const wrapped = new Error(message)
    wrapped.status = error.response?.status
    wrapped.details = error.response?.data?.details
    return Promise.reject(wrapped)
  }
)

const unwrap = (promise) => promise.then((r) => r.data)

export const api = {
  /* auth */
  login: (password) => unwrap(apiClient.post("/admin/login", { password })),
  verify: () => unwrap(apiClient.get("/admin/verify")),
  logout: () => unwrap(apiClient.get("/admin/logout")),

  /* quizzes */
  listQuizzes: () => unwrap(apiClient.get("/admin/quizzes")),
  getQuiz: (id) => unwrap(apiClient.get(`/admin/quizzes/${id}`)),
  createQuiz: (payload) => unwrap(apiClient.post("/admin/quizzes", payload)),
  updateQuiz: (id, payload) => unwrap(apiClient.put(`/admin/quizzes/${id}`, payload)),
  activateQuiz: (id) => unwrap(apiClient.put(`/admin/quizzes/${id}/activate`, {})),
  deleteQuiz: (id) => unwrap(apiClient.delete(`/admin/quizzes/${id}`)),

  /* whitelist */
  listAllowed: (params) => unwrap(apiClient.get("/admin/allowed-users", { params })),
  addAllowed: (payload) => unwrap(apiClient.post("/admin/allowed-users", payload)),
  bulkAddAllowed: (entries) => unwrap(apiClient.post("/admin/allowed-users/bulk", { entries })),
  updateAllowed: (id, payload) => unwrap(apiClient.put(`/admin/allowed-users/${id}`, payload)),
  deleteAllowed: (id) => unwrap(apiClient.delete(`/admin/allowed-users/${id}`)),

  /* results */
  listResults: (params) => unwrap(apiClient.get("/admin/results", { params })),
  getResult: (id) => unwrap(apiClient.get(`/admin/results/${id}`)),
  getAnalytics: () => unwrap(apiClient.get("/admin/analytics")),
  setQualification: (id, payload) =>
    unwrap(apiClient.put(`/admin/results/${id}/qualification`, payload)),
  shortlist: (payload) => unwrap(apiClient.post("/admin/results/shortlist", payload)),
  resetAttempt: (id) => unwrap(apiClient.put(`/admin/results/${id}/reset`, {})),
  deleteResult: (id) => unwrap(apiClient.delete(`/admin/results/${id}`)),

  /** Downloads the CSV export as a Blob, preserving the server's filename. */
  exportResults: async (params) => {
    const response = await apiClient.get("/admin/export-results", { params, responseType: "blob" })
    const disposition = response.headers["content-disposition"] || ""
    const match = disposition.match(/filename="?([^"]+)"?/)
    return { blob: response.data, filename: match?.[1] || "results.csv" }
  }
}

export default apiClient
