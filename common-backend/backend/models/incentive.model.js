import mongoose from "mongoose"

const incentiveSchema = new mongoose.Schema(
  {
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Website",
      required: true,
    },
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    type: {
      type: String,
      enum: ["fixed", "percentage"],
      default: "fixed",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    period: {
      type: String,
      enum: ["monthly", "quarterly", "yearly", "one_time"],
      default: "monthly",
    },
    month: {
      type: Number,
      min: 1,
      max: 12,
      default: null,
    },
    year: {
      type: Number,
      default: null,
    },
    targetLeads: {
      type: Number,
      default: 0,
      min: 0,
    },
    targetRevenue: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
)

incentiveSchema.index({ website: 1, agent: 1, period: 1, month: 1, year: 1, deleted: 1 })
incentiveSchema.index({ website: 1, deleted: 1, isActive: 1 })

export default mongoose.model("Incentive", incentiveSchema)

