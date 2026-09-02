import { Router } from "express"
import { adminAuthMiddleware } from "../middlewares/auth.middleware.js"
import { limitAdminAuth } from "../middlewares/rateLimit.middleware.js"
import {
  activateQuiz,
  addAllowedUser,
  adminLogin,
  adminLogout,
  bulkAddAllowedUsers,
  createQuiz,
  deleteAllowedUser,
  deleteQuiz,
  deleteUserResult,
  exportResults,
  getAllowedUserById,
  getAllowedUsers,
  getAllQuizzes,
  getAllResults,
  getAnalytics,
  getQuizById,
  getResultById,
  resetUserAttempt,
  shortlistCandidates,
  updateAllowedUser,
  updateQualificationStatus,
  updateQuiz,
  verifyAdmin
} from "../controllers/admin.controllers.js"

const adminRoutes = Router()

// Public.
adminRoutes.post("/login", limitAdminAuth, adminLogin)

// Everything below requires the admin session cookie.
adminRoutes.use(adminAuthMiddleware)

adminRoutes.get("/verify", verifyAdmin)
adminRoutes.get("/logout", adminLogout)

// Quizzes.
adminRoutes.get("/quizzes", getAllQuizzes)
adminRoutes.post("/quizzes", createQuiz)
adminRoutes.get("/quizzes/:id", getQuizById)
adminRoutes.put("/quizzes/:id", updateQuiz)
adminRoutes.delete("/quizzes/:id", deleteQuiz)
adminRoutes.put("/quizzes/:id/activate", activateQuiz)

// Whitelist.
adminRoutes.get("/allowed-users", getAllowedUsers)
adminRoutes.post("/allowed-users", addAllowedUser)
adminRoutes.post("/allowed-users/bulk", bulkAddAllowedUsers)
adminRoutes.get("/allowed-users/:id", getAllowedUserById)
adminRoutes.put("/allowed-users/:id", updateAllowedUser)
adminRoutes.delete("/allowed-users/:id", deleteAllowedUser)

// Results and analytics.
adminRoutes.get("/analytics", getAnalytics)
adminRoutes.get("/results", getAllResults)
adminRoutes.get("/export-results", exportResults)
adminRoutes.post("/results/shortlist", shortlistCandidates)
adminRoutes.get("/results/:id", getResultById)
adminRoutes.put("/results/:id/qualification", updateQualificationStatus)
adminRoutes.put("/results/:id/reset", resetUserAttempt)
adminRoutes.delete("/results/:id", deleteUserResult)

export default adminRoutes
