/**
 * Review email scheduler.
 * Polls MongoDB every 5 minutes for ReviewEmailJob documents where
 * status === "pending" and sendAt <= now. Sends the review request
 * email and marks the job as "sent" or "failed".
 *
 * Start with: startReviewEmailScheduler()  (called once at server boot)
 */

import ReviewEmailJob from "../models/reviewEmailJob.model.js"
import { sendReviewRequestEmail } from "./emailVerification.js"

const POLL_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const MAX_ATTEMPTS = 3
const BATCH_SIZE = 20

let intervalId = null

async function processReviewEmails() {
  try {
    const now = new Date()
    const jobs = await ReviewEmailJob.find({
      status: "pending",
      sendAt: { $lte: now },
      attempts: { $lt: MAX_ATTEMPTS },
    })
      .sort({ sendAt: 1 })
      .limit(BATCH_SIZE)

    if (jobs.length === 0) return

    console.log(`[reviewScheduler] Processing ${jobs.length} review email(s)`)

    for (const job of jobs) {
      try {
        const sent = await sendReviewRequestEmail(job)
        if (sent) {
          job.status = "sent"
          job.sentAt = new Date()
        } else {
          job.attempts += 1
          job.lastError = "Email send returned false"
          if (job.attempts >= MAX_ATTEMPTS) job.status = "failed"
        }
      } catch (err) {
        job.attempts += 1
        job.lastError = err.message
        if (job.attempts >= MAX_ATTEMPTS) job.status = "failed"
        console.error(`[reviewScheduler] Error processing job ${job._id}:`, err.message)
      }
      await job.save()
    }
  } catch (err) {
    console.error("[reviewScheduler] Poll error:", err.message)
  }
}

export function startReviewEmailScheduler() {
  if (intervalId) return
  console.log("[reviewScheduler] Started — polling every", POLL_INTERVAL_MS / 1000, "seconds")
  // Run immediately on startup, then on interval
  processReviewEmails()
  intervalId = setInterval(processReviewEmails, POLL_INTERVAL_MS)
}

export function stopReviewEmailScheduler() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    console.log("[reviewScheduler] Stopped")
  }
}

/**
 * Schedule a review email for an order. Called after order is saved.
 * @param {Object} order - Populated order document
 */
export async function scheduleReviewEmail(order) {
  if (!order) return

  const toEmail =
    order.shippingAddress?.email ||
    order.billingAddress?.email ||
    order.user?.email
  const customerName =
    order.shippingAddress?.name ||
    order.billingAddress?.name ||
    order.user?.name ||
    "Customer"

  if (!toEmail || !String(toEmail).includes("@")) {
    console.warn("[reviewScheduler] No email for review job, order:", order.orderNumber)
    return
  }

  if (!order.products || order.products.length === 0) return

  const products = order.products.map((p) => ({
    productId: p.product?._id || p.product || p.productId,
    productName: p.productName || p.product?.name || "Product",
    productImage: p.productImage || (p.product?.images?.[0]) || null,
  }))

  const sendAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 day from now

  try {
    await ReviewEmailJob.create({
      order: order._id,
      user: order.user?._id || order.user,
      toEmail,
      customerName,
      products,
      orderNumber: order.orderNumber || order._id,
      sendAt,
      website: order.website,
    })
    console.log("[reviewScheduler] Scheduled review email for order", order.orderNumber, "at", sendAt.toISOString())
  } catch (err) {
    console.error("[reviewScheduler] Failed to schedule:", err.message)
  }
}
