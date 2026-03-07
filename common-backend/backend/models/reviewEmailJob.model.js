import mongoose from "mongoose"

const reviewEmailJobSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    toEmail: {
      type: String,
      required: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    products: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        productName: { type: String, required: true },
        productImage: { type: String, default: null },
      },
    ],
    orderNumber: {
      type: String,
      required: true,
    },
    sendAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "sent", "failed", "cancelled"],
      default: "pending",
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastError: {
      type: String,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Website",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
)

reviewEmailJobSchema.index({ status: 1, sendAt: 1 })

const ReviewEmailJob = mongoose.model("ReviewEmailJob", reviewEmailJobSchema)
export default ReviewEmailJob
