import mongoose from "mongoose"

/**
 * Newsletter Subscriber Model
 *
 * Stores email subscriptions from the footer newsletter form.
 * Multi-tenant: scoped by website.
 */

const newsletterSubscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Website",
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
)

// Unique compound index: one subscription per email per website
newsletterSubscriberSchema.index({ email: 1, website: 1 }, { unique: true })
newsletterSubscriberSchema.index({ website: 1, createdAt: -1 })

export default mongoose.model("NewsletterSubscriber", newsletterSubscriberSchema)
