import mongoose from "mongoose"

/**
 * Temporary OTP sessions for mobile login.
 * phone: normalized 10-digit (Indian)
 * otpHash: SHA-256 hash of the 6-digit OTP
 * expiresAt: session expiry (e.g. 10 min)
 */
const otpSessionSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, index: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
)

otpSessionSchema.index({ phone: 1, expiresAt: 1 })

export default mongoose.model("OtpSession", otpSessionSchema)
