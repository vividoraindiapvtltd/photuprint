import mongoose from "mongoose"

/**
 * Pending registration: stores sign-up data until email is verified.
 * User is created in User collection only after successful verification.
 */
const pendingRegistrationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
    name: { type: String, required: true, trim: true },
    password: { type: String, required: true },
    phone: { type: String, default: null, trim: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
)

// unique: true on email above creates { email: 1 }; no need to duplicate with schema.index
pendingRegistrationSchema.index({ tokenHash: 1 })
pendingRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.model("PendingRegistration", pendingRegistrationSchema)
