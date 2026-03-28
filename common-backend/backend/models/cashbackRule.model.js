import mongoose from "mongoose"

/**
 * Configurable cashback % — product > category > default (by priority).
 */
const cashbackRuleSchema = new mongoose.Schema(
  {
    website: { type: mongoose.Schema.Types.ObjectId, ref: "Website", required: true, index: true },
    scope: {
      type: String,
      enum: ["default", "category", "product"],
      default: "default",
      index: true,
    },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    /** 0–100 */
    percent: { type: Number, required: true, min: 0, max: 100 },
    /** Days until credited cashback expires if unused */
    expiryDays: { type: Number, default: 90, min: 1, max: 3650 },
    /** Higher applies first when multiple rules match */
    priority: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    notes: { type: String, default: null },
  },
  { timestamps: true }
)

cashbackRuleSchema.index({ website: 1, scope: 1, product: 1 })
cashbackRuleSchema.index({ website: 1, scope: 1, category: 1 })

export default mongoose.model("CashbackRule", cashbackRuleSchema)
