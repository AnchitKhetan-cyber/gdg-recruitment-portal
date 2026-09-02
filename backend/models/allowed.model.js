import mongoose from "mongoose"

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const PHONE_REGEX = /^[0-9]{10}$/

/**
 * Whitelist of candidates permitted to sign in. Anyone whose Google account
 * email is not in this collection is rejected at authentication time.
 */
const allowedSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [EMAIL_REGEX, "Please enter a valid email address"]
    },

    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters long"],
      maxlength: [50, "Name cannot exceed 50 characters"]
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [PHONE_REGEX, "Phone number must be a valid 10-digit number"]
    },

    /** Optional cohort tag, e.g. "2027-batch" or "web-dev". */
    tag: {
      type: String,
      trim: true,
      maxlength: [40, "Tag cannot exceed 40 characters"],
      default: ""
    }
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "allowed_users"
  }
)

allowedSchema.index({ name: "text", email: "text" })

allowedSchema.pre("save", function (next) {
  if (this.email) this.email = this.email.toLowerCase().trim()
  if (this.name) this.name = this.name.trim()
  if (this.phone) this.phone = this.phone.trim()
  next()
})

export const Allowed = mongoose.model("Allowed", allowedSchema)
