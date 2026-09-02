import { Router } from "express"
import {
  authMiddleware,
  firebaseAuthMiddleware
} from "../middlewares/auth.middleware.js"
import { limitAuth, limitAutosave } from "../middlewares/rateLimit.middleware.js"
import {
  firebaseAuth,
  logout,
  recordViolation,
  saveProgress,
  startQuiz,
  submitQuiz,
  verifyAuth
} from "../controllers/user.controllers.js"

const userRoutes = Router()

// Sign-in: the only endpoint that accepts a Firebase ID token.
userRoutes.post("/firebase-auth", limitAuth, firebaseAuthMiddleware, firebaseAuth)

// Session.
userRoutes.get("/verify", authMiddleware, verifyAuth)
userRoutes.get("/logout", authMiddleware, logout)

// Attempt lifecycle.
userRoutes.post("/start-quiz", authMiddleware, startQuiz)
userRoutes.post("/save-progress", limitAutosave, authMiddleware, saveProgress)
userRoutes.post("/violation", limitAutosave, authMiddleware, recordViolation)
userRoutes.post("/submit-quiz", authMiddleware, submitQuiz)

export default userRoutes
