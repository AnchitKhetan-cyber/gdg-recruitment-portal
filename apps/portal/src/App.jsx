import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { Toaster } from "sonner"
import SignInPage from "./pages/SignInPage"
import InstructionsPage from "./pages/InstructionsPage"
import SystemCheckPage from "./pages/SystemCheckPage"
import TestPage from "./pages/TestPage"
import SubmittedPage from "./pages/SubmittedPage"
import ProtectedRoute from "./components/ProtectedRoute"

const App = () => (
  <BrowserRouter>
    <Toaster position="top-center" richColors closeButton />

    <Routes>
      <Route path="/" element={<SignInPage />} />

      <Route
        path="/instructions"
        element={
          <ProtectedRoute>
            <InstructionsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/system-check"
        element={
          <ProtectedRoute>
            <SystemCheckPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/test"
        element={
          <ProtectedRoute>
            <TestPage />
          </ProtectedRoute>
        }
      />

      {/* Reached after the session is closed, so this route is deliberately open. */}
      <Route path="/submitted" element={<SubmittedPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
)

export default App
