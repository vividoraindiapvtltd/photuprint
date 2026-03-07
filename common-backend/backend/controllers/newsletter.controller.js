import NewsletterSubscriber from "../models/newsletterSubscriber.model.js"
import FooterSection from "../models/footerSection.model.js"
import { sendNewsletterWelcomeEmail } from "../utils/emailVerification.js"

/**
 * Subscribe an email to the newsletter (public storefront endpoint)
 */
export const subscribe = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id

    if (!websiteId) {
      return res.status(400).json({
        msg: "Website context is required",
        code: "MISSING_WEBSITE_CONTEXT",
      })
    }

    const { email } = req.body

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        msg: "Email is required",
        code: "EMAIL_REQUIRED",
      })
    }

    const trimmedEmail = email.trim().toLowerCase()
    const emailRegex = /^\S+@\S+\.\S+$/
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        msg: "Please provide a valid email address",
        code: "INVALID_EMAIL",
      })
    }

    // Check for existing subscription
    const existing = await NewsletterSubscriber.findOne({
      email: trimmedEmail,
      website: websiteId,
    })

    if (existing) {
      return res.status(200).json({
        msg: existing.isActive ? "You are already subscribed." : "Subscription reactivated.",
        code: "ALREADY_SUBSCRIBED",
        subscribed: true,
      })
    }

    // Create new subscription
    await NewsletterSubscriber.create({
      email: trimmedEmail,
      website: websiteId,
      isActive: true,
    })

    // Send welcome/confirmation email to the user (non-blocking; errors logged only)
    sendNewsletterWelcomeEmail(trimmedEmail).catch(() => {})

    // Optionally fetch custom success message from newsletter footer section
    let successMessage = "Thank you for subscribing!"
    const newsletterSection = await FooterSection.findOne({
      website: websiteId,
      type: "newsletter",
      isActive: true,
    })
      .select("config.successMessage")
      .lean()
    if (newsletterSection?.config?.successMessage?.trim()) {
      successMessage = newsletterSection.config.successMessage.trim()
    }

    res.status(201).json({
      msg: successMessage,
      code: "SUBSCRIBED",
      subscribed: true,
    })
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key (race condition)
      return res.status(200).json({
        msg: "You are already subscribed.",
        code: "ALREADY_SUBSCRIBED",
        subscribed: true,
      })
    }
    console.error("Error subscribing to newsletter:", error)
    res.status(500).json({
      msg: "Failed to subscribe. Please try again later.",
      code: "SERVER_ERROR",
    })
  }
}
