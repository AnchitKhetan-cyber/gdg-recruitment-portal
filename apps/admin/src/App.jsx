import { useEffect } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { Toaster } from "sonner"
import { useAdminStore } from "./store/admin.store"
import AdminLayout from "./components/AdminLayout"
import { Spinner } from "./components/ui"
import LoginPage from "./pages/LoginPage"
import DashboardPage from "./pages/DashboardPage"
import ResultsPage from "./pages/ResultsPage"
import CandidateDetailPage from "./pages/CandidateDetailPage"
import QuizzesPage from "./pages/QuizzesPage"
import QuizEditorPage from "./pages/QuizEditorPage"
import CandidatesPage from "./pages/CandidatesPage"

/** Blocks every admin route until the session cookie has been verified. */
const RequireAdmin = ({ children }) => {
  const status = useAdminStore((s) => s.status)
  const check = useAdminStore((s) => s.check)

  useEffect(() => {
    if (status === "unknown") check()
  }, [status, check])

  if (status === "unknown") return <Spinner label="Checking your session" />
  if (status === "anonymous") return <Navigate to="/login" replace />

  return children
}

const App = () => (
  <BrowserRouter>
    <Toaster position="top-right" richColors closeButton />

    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/results/:id" element={<CandidateDetailPage />} />
        <Route path="/quizzes" element={<QuizzesPage />} />
        <Route path="/quizzes/:id" element={<QuizEditorPage />} />
        <Route path="/candidates" element={<CandidatesPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  </BrowserRouter>
)

export default App
