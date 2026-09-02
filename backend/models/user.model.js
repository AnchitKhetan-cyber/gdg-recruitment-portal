import mongoose from "mongoose"
import { EMAIL_REGEX, PHONE_REGEX } from "./allowed.model.js"

/**
 * A frozen copy of the questions served to one candidate.
 *
 * The snapshot exists so that editing a quiz mid-drive cannot change or corrupt
 * an attempt that is already in flight. The two answer-key fields are
 * `select: false` AND stripped in `toJSON`, so they can never leak through an
 * admin endpoint that returns a user document.
 */
const questionSnapshotSchema = new mongoose.Schema(
  {
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    question: String,
    options: [String],
    image: String,
    marks: { type: Number, default: 1 },
    correctAnswers: { type: Number, select: false },
    answer: { type: String, select: false }
  },
  { _id: false }
)

questionSnapshotSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.correctAnswers
    delete ret.answer
    return ret
  }
})

const quizSnapshotSchema = new mongoose.Schema(
  {
    quizId: mongoose.Schema.Types.ObjectId,
    title: String,
    description: String,
    duration: Number,
    questions: [questionSnapshotSchema]
  },
  { _id: false }
)

const responseSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    /** Index into the question's options; -1 means "left unanswered". */
    selectedOption: { type: Number, default: -1, min: -1 },
    isCorrect: { type: Boolean, default: false }
  },
  { _id: false }
)

/**
 * Proctoring events fall into two classes.
 *
 * ENFORCED events are unambiguous acts by the candidate - they left the tab,
 * they left fullscreen - so the server counts them and closes the attempt at
 * the limit.
 *
 * ADVISORY events come from heuristics that are wrong often enough that acting
 * on them automatically would fail honest candidates. A phone-shaped object in
 * a webcam frame is a reason for a human to look, not to end someone's
 * application. They are recorded and surfaced for review, and never auto-submit.
 */
export const ENFORCED_VIOLATIONS = ["tab-switch", "window-blur", "fullscreen-exit"]

export const ADVISORY_VIOLATIONS = [
  "copy",
  "paste",
  "devtools",
  "device-detected",
  "multiple-people",
  "no-person"
]

export const VIOLATION_TYPES = [...ENFORCED_VIOLATIONS, ...ADVISORY_VIOLATIONS]

const violationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: VIOLATION_TYPES,
      required: true
    },
    at: { type: Date, default: Date.now },
    /** Free-text detail, e.g. which object the camera matched. */
    detail: { type: String, default: "", maxlength: 200 },
    /** Detector confidence 0-1, present only for camera events. */
    confidence: { type: Number, min: 0, max: 1 }
  },
  { _id: false }
)

const userSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters long"],
      maxlength: [50, "Name cannot exceed 50 characters"]
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [EMAIL_REGEX, "Please enter a valid email address"]
    },
    phone: {
      type: String,
      trim: true,
      match: [PHONE_REGEX, "Phone number must be a valid 10-digit number"]
    },

    hasStarted: { type: Boolean, default: false, index: true },
    hasSubmitted: { type: Boolean, default: false, index: true },

    /**
     * Server-side clock anchor. The remaining time is always derived from this
     * on the server, so clearing localStorage no longer grants a fresh timer.
     */
    startedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: null },

    /** Seconds consumed, persisted on every autosave so a resume is accurate. */
    timeUsed: {
      type: Number,
      default: 0,
      min: [0, "Time used cannot be negative"]
    },

    score: {
      type: Number,
      default: 0,
      min: [0, "Score cannot be negative"]
    },
    maxScore: { type: Number, default: 0, min: 0 },

    responses: { type: [responseSchema], default: [] },
    violations: { type: [violationSchema], default: [] },

    /** Set when the attempt ended for a reason other than the candidate submitting. */
    autoSubmitted: { type: Boolean, default: false },
    autoSubmitReason: {
      type: String,
      enum: ["time-expired", "violations-exceeded", null],
      default: null
    },

    qualifiedForInterview: { type: Boolean, default: false, index: true },
    adminNotes: { type: String, default: "", maxlength: 2000 },

    quiz: { type: quizSnapshotSchema, default: null }
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "users"
  }
)

userSchema.index({ name: "text", email: "text" })

userSchema.pre("save", function (next) {
  if (this.email) this.email = this.email.toLowerCase().trim()
  if (this.name) this.name = this.name.trim()
  if (this.phone) this.phone = this.phone.trim()
  next()
})

/** Seconds of attempt time remaining, derived from the server-side anchor. */
/** Only enforced events count toward the auto-submit limit. */
userSchema.methods.getEnforcedViolationCount = function () {
  return (this.violations || []).filter((v) => ENFORCED_VIOLATIONS.includes(v.type)).length
}

userSchema.methods.getAdvisoryFlagCount = function () {
  return (this.violations || []).filter((v) => ADVISORY_VIOLATIONS.includes(v.type)).length
}

userSchema.methods.getTimeRemaining = function () {
  if (!this.startedAt || !this.quiz?.duration) return 0
  const total = this.quiz.duration * 60
  const elapsed = Math.floor((Date.now() - this.startedAt.getTime()) / 1000)
  return Math.max(0, total - elapsed)
}

/** Seconds by which the attempt has run past its deadline (0 while in time). */
userSchema.methods.getOverdueSeconds = function () {
  if (!this.startedAt || !this.quiz?.duration) return 0
  const total = this.quiz.duration * 60
  const elapsed = Math.floor((Date.now() - this.startedAt.getTime()) / 1000)
  return Math.max(0, elapsed - total)
}

userSchema.methods.getElapsedSeconds = function () {
  if (!this.startedAt || !this.quiz?.duration) return 0
  const total = this.quiz.duration * 60
  const elapsed = Math.floor((Date.now() - this.startedAt.getTime()) / 1000)
  return Math.min(total, Math.max(0, elapsed))
}

/**
 * The candidate-safe view of the assigned quiz: no correct answers, ever.
 */
userSchema.methods.getPublicQuiz = function () {
  if (!this.quiz) return null
  return {
    quizId: this.quiz.quizId,
    title: this.quiz.title,
    description: this.quiz.description,
    duration: this.quiz.duration,
    questions: (this.quiz.questions || []).map((q) => ({
      id: q.id.toString(),
      question: q.question,
      options: q.options,
      image: q.image || null,
      marks: q.marks ?? 1
    }))
  }
}

/**
 * Loads a user with the answer key attached. Only the scoring path may call
 * this - every other query gets the redacted document by default.
 */
userSchema.statics.findByIdWithAnswerKey = function (id) {
  return this.findById(id).select("+quiz.questions.correctAnswers +quiz.questions.answer")
}

export const User = mongoose.model("User", userSchema)
