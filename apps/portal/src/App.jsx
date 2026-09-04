import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { Toaster } from "sonner"
import SignInPage from "./pages/SignInPage"
import InstructionsPage from "./pages/InstructionsPage"
import SystemCheckPage from "./pages/SystemCheckPage"
import TestPage from "./pages/TestPage"
import SubmittedPage from "./pages/SubmittedPage"
import ProtectedRoute from "./components/ProtectedRoute"
import DesktopOnly from "./components/DesktopOnly"
import ErrorBoundary from "./components/ErrorBoundary"

// The assessment is desktop/laptop only. DesktopOnly wraps every route, so a
// phone or tablet sees the "use a laptop" screen from the very first page.
// ErrorBoundary is outermost so a render crash anywhere shows a safe, reassuring
// screen instead of a blank page - the answers are already on the server.
const App = () => (
  <ErrorBoundary>
    <DesktopOnly>
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
    </DesktopOnly>
  </ErrorBoundary>
)

export default App
