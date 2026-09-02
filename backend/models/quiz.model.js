import mongoose from "mongoose"

const questionSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: [true, "Question is required"],
      trim: true,
      minlength: [5, "Question must be at least 5 characters long"]
    },
    options: {
      type: [String],
      required: [true, "Options are required"],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length >= 2 && arr.length <= 6,
        message: "A question must have between 2 and 6 options"
      }
    },
    /**
     * Index into `options` of the correct choice. This is the single source of
     * truth for scoring - the old free-text `answer` field is kept only as a
     * human-readable label for the admin UI.
     */
    correctAnswers: {
      type: Number,
      required: [true, "A correct option index is required"],
      min: [0, "Correct option index cannot be negative"]
    },
    answer: {
      type: String,
      trim: true,
      default: ""
    },
    image: {
      type: String,
      trim: true,
      default: "",
      validate: {
        validator: (v) => !v || /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(v),
        message: "Invalid image URL"
      }
    },
    marks: {
      type: Number,
      default: 1,
      min: [0, "Marks cannot be negative"]
    }
  },
  { _id: true }
)

questionSchema.pre("validate", function (next) {
  // Keep `answer` in sync with the authoritative index so the two can never
  // disagree - a mismatch was what made scoring unpredictable previously.
  if (Array.isArray(this.options) && Number.isInteger(this.correctAnswers)) {
    if (this.correctAnswers >= this.options.length) {
      return next(
        new Error(
          `correctAnswers (${this.correctAnswers}) is out of range for ${this.options.length} options`
        )
      )
    }
    this.answer = this.options[this.correctAnswers]
  }
  next()
})

const quizSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: [3, "Title must be at least 3 characters long"]
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      minlength: [10, "Description must be at least 10 characters long"]
    },
    questions: {
      type: [questionSchema],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "At least one question is required"
      }
    },
    /** Total attempt time, in minutes. */
    duration: {
      type: Number,
      required: [true, "Duration is required"],
      min: [1, "Duration must be at least 1 minute"]
    },
    /**
     * How many questions each candidate receives, drawn at random from the
     * pool above. Falls back to the whole pool when unset.
     */
    questionsPerAttempt: {
      type: Number,
      default: 15,
      min: [1, "questionsPerAttempt must be at least 1"]
    },
    /**
     * Exactly one quiz is served to candidates at a time. The old code hardcoded
     * `Quiz.findOne()`, which made the admin's multi-quiz CRUD unreachable.
     */
    isActive: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "quizzes"
  }
)

quizSchema.virtual("questionCount").get(function () {
  return this.questions?.length || 0
})

quizSchema.set("toJSON", { virtuals: true })
quizSchema.set("toObject", { virtuals: true })

/** Returns the quiz currently served to candidates, if any. */
quizSchema.statics.findActive = function (projection) {
  return this.findOne({ isActive: true }, projection)
}

/** Activates one quiz and deactivates every other in a single pass. */
quizSchema.statics.activateOnly = async function (quizId) {
  await this.updateMany({ _id: { $ne: quizId } }, { $set: { isActive: false } })
  return this.findByIdAndUpdate(quizId, { $set: { isActive: true } }, { new: true })
}

export const Quiz = mongoose.model("Quiz", quizSchema)
