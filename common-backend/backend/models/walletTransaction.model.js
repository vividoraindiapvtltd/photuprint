import mongoose from "mongoose"

/**
 * Immutable ledger entries — credit/debit with idempotency for financial safety.
 */
const walletTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    website: { type: mongoose.Schema.Types.ObjectId, ref: "Website", required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    /** positive = money in, negative = money out */
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    reason: {
      type: String,
      required: true,
      enum: [
        "cashback_order_delivered",
        "wallet_order_payment",
        "cashback_reversed_refund",
        "wallet_payment_reversed",
        "wallet_order_refund",
        "cashback_expired",
        "admin_adjustment",
      ],
    },
    /** Idempotent operation key — globally unique when set */
    idempotencyKey: { type: String, default: null, sparse: true, unique: true },
    /** When cashback credit expires (wallet may auto-debit later) */
    expiresAt: { type: Date, default: null, index: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
)

walletTransactionSchema.index({ user: 1, website: 1, createdAt: -1 })
walletTransactionSchema.index({ order: 1, reason: 1 })

export default mongoose.model("WalletTransaction", walletTransactionSchema)
