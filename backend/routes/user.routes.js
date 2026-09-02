import { Router } from "express"
import {
  authMiddleware,
  firebaseAuthMiddleware
} from "../middlewares/auth.middleware.js"
import { limitAuth, limitPerUser } from "../middlewares/rateLimit.middleware.js"
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

// Sign-in: the only endpoint that accepts a Firebase ID token, and the only
// candidate route limited per IP - there is no user identity to key on yet.
userRoutes.post("/firebase-auth", limitAuth, firebaseAuthMiddleware, firebaseAuth)

// Everything below is limited PER CANDIDATE. The limiter is mounted after
// authMiddleware on purpose: req.user only exists, and is only trustworthy,
// once the session cookie has been verified.
userRoutes.get("/verify", authMiddleware, limitPerUser, verifyAuth)
userRoutes.get("/logout", authMiddleware, logout)

userRoutes.post("/start-quiz", authMiddleware, limitPerUser, startQuiz)
userRoutes.post("/save-progress", authMiddleware, limitPerUser, saveProgress)
userRoutes.post("/violation", authMiddleware, limitPerUser, recordViolation)
userRoutes.post("/submit-quiz", authMiddleware, limitPerUser, submitQuiz)

export default userRoutes
