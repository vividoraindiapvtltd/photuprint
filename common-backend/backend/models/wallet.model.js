import mongoose from "mongoose"

/**
 * One wallet per (user, website) — balance in minor currency unit or whole INR as per site convention (here: same as orders, rupees with 2dp).
 */
const walletSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    website: { type: mongoose.Schema.Types.ObjectId, ref: "Website", required: true, index: true },
    balance: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "INR", trim: true },
  },
  { timestamps: true }
)

walletSchema.index({ user: 1, website: 1 }, { unique: true })

export default mongoose.model("Wallet", walletSchema)
