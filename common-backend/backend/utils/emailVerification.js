import nodemailer from "nodemailer"

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || process.env.CLIENT_URL || "http://localhost:3000"

/** Send via Brevo HTTP API (uses API key xkeysib-). Bypasses SMTP 535 auth issues. */
async function sendViaBrevoApi(toEmail, html, subject, senderEmail, senderName) {
  const apiKey = (process.env.BREVO_API_KEY || "").trim()
  if (!apiKey || !/^xkeysib-/i.test(apiKey)) return false
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName || "Photuprint" },
      to: [{ email: toEmail }],
      subject,
      htmlContent: html,
    }),
  })
  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Brevo API ${res.status}: ${errBody}`)
  }
  return true
}

/**
 * Create nodemailer transporter for SMTP. Uses same config as verification emails.
 * Shared by sendVerificationEmail and sendNewsletterWelcomeEmail.
 * Returns { transporter, user } or null if credentials missing.
 */
function createEmailTransporter() {
  const host = (process.env.SMTP_HOST || "").trim().toLowerCase()
  const isBrevoHost = host.includes("brevo.com")
  const hasBrevoCreds = process.env.BREVO_SMTP_LOGIN && process.env.BREVO_SMTP_KEY

  let user, pass
  if (isBrevoHost && hasBrevoCreds) {
    user = (process.env.BREVO_SMTP_LOGIN || "").trim()
    pass = (process.env.BREVO_SMTP_KEY || "").trim()
  } else {
    user = (process.env.SMTP_USER || process.env.BREVO_SMTP_LOGIN || "").trim()
    let rawPass = (process.env.SMTP_PASS || "").trim()
    const isPlaceholder = /your-|from-brevo-dashboard|placeholder|xxx|example\.com/i.test(rawPass)
    if (!rawPass || isPlaceholder) {
      rawPass = (process.env.BREVO_SMTP_KEY || process.env.RESEND_API_KEY || "").trim()
    }
    pass = rawPass
  }

  if (!user || !pass) return null

  const useBrevo = (process.env.BREVO_SMTP_LOGIN || process.env.BREVO_SMTP_KEY) && !process.env.SMTP_HOST
  const smtpHost = (process.env.SMTP_HOST || (useBrevo ? "smtp-relay.brevo.com" : "smtp.resend.com")).trim()
  const port = Number(process.env.SMTP_PORT) || (useBrevo ? 587 : 465)
  const secure =
    process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE !== "false"
      : port === 465

  if ((useBrevo || isBrevoHost) && /^xkeysib-/i.test(pass)) {
    console.error(
      "[email] BREVO_SMTP_KEY looks like an API key. For SMTP use the SMTP key (xsmtpsib-...) from Brevo → SMTP & API → SMTP."
    )
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port,
    secure,
    auth: { user, pass },
  })
  return { transporter, user }
}

function getVerificationEmailHtml(verificationLink) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email</title>
</head>
<body style="margin:0; font-family: system-ui, -apple-system, sans-serif; background:#f5f5f5; padding: 24px;">
  <div style="max-width: 480px; margin: 0 auto; background:#fff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <h1 style="margin:0 0 16px; font-size: 22px; color:#111;">Verify your email</h1>
    <p style="margin:0 0 24px; color:#444; line-height: 1.5;">Thanks for signing up. Click the button below to verify your email and activate your account.</p>
    <p style="margin:0 0 24px;">
      <a href="${verificationLink}" style="display: inline-block; padding: 12px 24px; background:#2563eb; color:#fff !important; text-decoration: none; border-radius: 8px; font-weight: 600;">Verify email address</a>
    </p>
    <p style="margin:0; font-size: 13px; color:#666;">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Send verification email. Uses nodemailer with env:
 * SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS
 * Or Brevo: BREVO_SMTP_LOGIN, BREVO_SMTP_KEY (defaults host to smtp.brevo.com)
 * Or Resend: RESEND_API_KEY with smtp.resend.com
 * @param {string} toEmail
 * @param {string} token - raw token (only used in link, never stored)
 * @param {string} [returnPath] - path to redirect after verification (e.g. /cart)
 */
export async function sendVerificationEmail(toEmail, token, returnPath) {
  let verificationLink = `${FRONTEND_ORIGIN}/verify-email?token=${encodeURIComponent(token)}`
  if (returnPath && typeof returnPath === "string" && returnPath.trim() && returnPath !== "/") {
    verificationLink += `&returnTo=${encodeURIComponent(returnPath.trim())}`
  }
  const html = getVerificationEmailHtml(verificationLink)
  const subject = "Verify your email address"
  let senderEmail = (process.env.BREVO_SMTP_LOGIN || process.env.SMTP_USER || "noreply@example.com").trim()
  const fromMatch = (process.env.SMTP_FROM || "").match(/<([^>]+)>/)
  if (fromMatch) senderEmail = fromMatch[1].trim()
  else if (!senderEmail.includes("@")) senderEmail = process.env.BREVO_SMTP_LOGIN || "noreply@example.com"
  const senderName = (process.env.SMTP_FROM || "").match(/^([^<]+)</)?.[1]?.trim() || process.env.SMTP_FROM_NAME || "Photuprint"

  // 1. Try Brevo HTTP API first (avoids SMTP 535) - requires BREVO_API_KEY (xkeysib-...)
  const apiKey = (process.env.BREVO_API_KEY || "").trim()
  if (apiKey && /^xkeysib-/i.test(apiKey)) {
    try {
      await sendViaBrevoApi(toEmail, html, subject, senderEmail, senderName)
      console.log("[emailVerification] Sent via Brevo API to", toEmail)
      return
    } catch (err) {
      console.error("[emailVerification] Brevo API failed:", err.message)
      throw err
    }
  }

  // 2. SMTP
  const smtp = createEmailTransporter()
  if (!smtp) {
    console.warn("[emailVerification] SMTP credentials missing")
    throw new Error("SMTP credentials not configured. Verification email could not be sent.")
  }
  const { transporter, user } = smtp

  // Use branded From: "Photuprint <sender@domain>" - helps deliverability vs raw address
  const fromEmail = process.env.SMTP_FROM || process.env.EMAIL_FROM || (user.includes("@") ? user : "noreply@example.com")
  const fromName = process.env.SMTP_FROM_NAME || process.env.EMAIL_FROM_NAME || "Photuprint"
  const fromAddr = fromEmail.includes("<") ? fromEmail : `${fromName} <${fromEmail}>`

  if (process.env.NODE_ENV !== "production") {
    console.log("[emailVerification] Sending to:", toEmail, "| From:", fromAddr, "| Link:", verificationLink.substring(0, 60) + "...")
  }

  try {
    const info = await transporter.sendMail({
      from: fromAddr,
      to: toEmail,
      subject: "Verify your email address",
      html: getVerificationEmailHtml(verificationLink),
      replyTo: process.env.SMTP_REPLY_TO || process.env.EMAIL_REPLY_TO || undefined,
    })
    console.log("[emailVerification] Verification email sent to", toEmail, "| MessageId:", info.messageId || "(n/a)")
  } catch (sendErr) {
    const msg = sendErr.response ? sendErr.response + " " + (sendErr.responseCode || "") : sendErr.message
    console.error("[emailVerification] sendMail failed:", msg)
    if (sendErr.code) console.error("[emailVerification] Error code:", sendErr.code)
    throw sendErr
  }
}

function getNewsletterWelcomeHtml() {
  const homepageUrl = (process.env.FRONTEND_ORIGIN || process.env.CLIENT_URL || "http://localhost:3000").replace(/\/$/, "")
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're subscribed</title>
</head>
<body style="margin:0; font-family: system-ui, -apple-system, sans-serif; background:#f5f5f5; padding: 24px;">
  <div style="max-width: 480px; margin: 0 auto; background:#fff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <h1 style="margin:0 0 16px; font-size: 22px; color:#111;">You're in!</h1>
    <p style="margin:0 0 24px; color:#444; line-height: 1.5;">Thanks for subscribing. You'll get exclusive offers, special discounts, and first access to our latest collections.</p>
    <p style="margin:0 0 24px;">
      <a href="${homepageUrl}" style="display: inline-block; padding: 12px 24px; background:#2563eb; color:#fff !important; text-decoration: none; border-radius: 8px; font-weight: 600;">Explore best deals</a>
    </p>
    <p style="margin:0; font-size: 14px; color:#666;">— The PhotuPrint team</p>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Send a welcome/confirmation email to a new newsletter subscriber.
 * Uses same Brevo API or SMTP as verification emails. Does not throw; logs errors.
 * @param {string} toEmail
 */
export async function sendNewsletterWelcomeEmail(toEmail) {
  const subject = "You're subscribed — PhotuPrint"
  const html = getNewsletterWelcomeHtml()
  let senderEmail = (process.env.BREVO_SMTP_LOGIN || process.env.SMTP_USER || "noreply@example.com").trim()
  const fromMatch = (process.env.SMTP_FROM || "").match(/<([^>]+)>/)
  if (fromMatch) senderEmail = fromMatch[1].trim()
  else if (!senderEmail.includes("@")) senderEmail = process.env.BREVO_SMTP_LOGIN || "noreply@example.com"
  const senderName = (process.env.SMTP_FROM || "").match(/^([^<]+)</)?.[1]?.trim() || process.env.SMTP_FROM_NAME || "Photuprint"

  // 1. Try Brevo HTTP API first
  const apiKey = (process.env.BREVO_API_KEY || "").trim()
  if (apiKey && /^xkeysib-/i.test(apiKey)) {
    try {
      await sendViaBrevoApi(toEmail, html, subject, senderEmail, senderName)
      console.log("[newsletter] Welcome email sent via Brevo API to", toEmail)
      return true
    } catch (err) {
      console.error("[newsletter] Brevo API welcome email failed:", err.message)
      if (process.env.NODE_ENV !== "production") console.error("[newsletter] Full error:", err)
      return false
    }
  }

  // 2. SMTP (same config as verification emails)
  const smtp = createEmailTransporter()
  if (!smtp) {
    console.warn("[newsletter] SMTP not configured; welcome email skipped for", toEmail)
    return false
  }
  const { transporter, user } = smtp
  const fromEmail = process.env.SMTP_FROM || process.env.EMAIL_FROM || (user.includes("@") ? user : "noreply@example.com")
  const fromName = process.env.SMTP_FROM_NAME || process.env.EMAIL_FROM_NAME || "Photuprint"
  const fromAddr = fromEmail.includes("<") ? fromEmail : `${fromName} <${fromEmail}>`

  if (process.env.NODE_ENV !== "production") {
    console.log("[newsletter] Sending welcome email to", toEmail, "| From:", fromAddr)
  }

  try {
    const info = await transporter.sendMail({
      from: fromAddr,
      to: toEmail,
      subject,
      html,
      replyTo: process.env.SMTP_REPLY_TO || process.env.EMAIL_REPLY_TO || undefined,
    })
    console.log("[newsletter] Welcome email sent to", toEmail, "| MessageId:", info.messageId || "(n/a)")
    return true
  } catch (sendErr) {
    const msg = sendErr.response ? sendErr.response + " " + (sendErr.responseCode || "") : sendErr.message
    console.error("[newsletter] Welcome email failed:", msg)
    if (sendErr.code) console.error("[newsletter] Error code:", sendErr.code)
    if (process.env.NODE_ENV !== "production") console.error("[newsletter] Full error:", sendErr)
    return false
  }
}

function getOrderConfirmationHtml(order) {
  const orderNumber = order?.orderNumber || order?._id || "N/A"
  const customerName = order?.shippingAddress?.name || order?.user?.name || "Customer"
  const totalAmount = order?.totalAmount ?? 0
  const productList =
    order?.products
      ?.map((p) => `• ${p.productName || p.product?.name || "Item"} × ${p.quantity || 1} — ₹${((p.price || 0) * (p.quantity || 1)).toFixed(0)}`)
      .join("<br>") || "• Your order items"

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
</head>
<body style="margin:0; font-family: system-ui, -apple-system, sans-serif; background:#f5f5f5; padding: 24px;">
  <div style="max-width: 520px; margin: 0 auto; background:#fff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <h1 style="margin:0 0 16px; font-size: 22px; color:#111;">Order confirmed!</h1>
    <p style="margin:0 0 24px; color:#444; line-height: 1.5;">Hi ${customerName}, thank you for your order. Payment received successfully.</p>
    <div style="background:#f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <p style="margin:0 0 8px; font-weight: 600; color:#111;">Order #${orderNumber}</p>
      <p style="margin:0 0 12px; font-size: 14px; color:#666;">Total: ₹${totalAmount.toFixed(0)}</p>
      <p style="margin:0; font-size: 13px; color:#555; line-height: 1.6;">${productList}</p>
    </div>
    <p style="margin:0; font-size: 14px; color:#666;">We'll notify you when your order ships. — PhotuPrint</p>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Send order confirmation email after successful payment.
 * Uses same Brevo/SMTP config as other emails. Does not throw; logs errors.
 * @param {Object} order - Order document (with orderNumber, totalAmount, products, shippingAddress, user)
 */
export async function sendOrderConfirmationEmail(order) {
  const toEmail = order?.shippingAddress?.email || order?.billingAddress?.email || order?.user?.email
  if (!toEmail || !String(toEmail).includes("@")) {
    console.warn("[orderConfirmation] No valid email for order", order?.orderNumber)
    return false
  }

  const subject = `Order confirmed — ${order?.orderNumber || "PhotuPrint"}`
  const html = getOrderConfirmationHtml(order)
  let senderEmail = (process.env.BREVO_SMTP_LOGIN || process.env.SMTP_USER || "noreply@example.com").trim()
  const fromMatch = (process.env.SMTP_FROM || "").match(/<([^>]+)>/)
  if (fromMatch) senderEmail = fromMatch[1].trim()
  else if (!senderEmail.includes("@")) senderEmail = process.env.BREVO_SMTP_LOGIN || "noreply@example.com"
  const senderName = (process.env.SMTP_FROM || "").match(/^([^<]+)</)?.[1]?.trim() || process.env.SMTP_FROM_NAME || "PhotuPrint"

  const apiKey = (process.env.BREVO_API_KEY || "").trim()
  if (apiKey && /^xkeysib-/i.test(apiKey)) {
    try {
      await sendViaBrevoApi(toEmail, html, subject, senderEmail, senderName)
      console.log("[orderConfirmation] Email sent via Brevo API to", toEmail)
      return true
    } catch (err) {
      console.error("[orderConfirmation] Brevo API failed:", err.message)
      return false
    }
  }

  const smtp = createEmailTransporter()
  if (!smtp) {
    console.warn("[orderConfirmation] SMTP not configured; email skipped")
    return false
  }
  const { transporter, user } = smtp
  const fromEmail = process.env.SMTP_FROM || process.env.EMAIL_FROM || (user.includes("@") ? user : "noreply@example.com")
  const fromName = process.env.SMTP_FROM_NAME || process.env.EMAIL_FROM_NAME || "PhotuPrint"
  const fromAddr = fromEmail.includes("<") ? fromEmail : `${fromName} <${fromEmail}>`

  try {
    await transporter.sendMail({
      from: fromAddr,
      to: toEmail,
      subject,
      html,
      replyTo: process.env.SMTP_REPLY_TO || process.env.EMAIL_REPLY_TO || undefined,
    })
    console.log("[orderConfirmation] Email sent to", toEmail)
    return true
  } catch (sendErr) {
    console.error("[orderConfirmation] Email failed:", sendErr.message)
    return false
  }
}

// ---------------------------------------------------------------------------
// Product review request email (sent 1 day after order)
// ---------------------------------------------------------------------------

function getReviewEmailHtml({ customerName, orderNumber, products, frontendOrigin }) {
  const productRows = products
    .map((p) => {
      const reviewUrl = `${frontendOrigin}/review?orderId=${encodeURIComponent(orderNumber)}&productId=${encodeURIComponent(p.productId)}`
      const imgTag = p.productImage
        ? `<img src="${p.productImage}" alt="${p.productName}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;display:block;" />`
        : `<div style="width:60px;height:60px;border-radius:6px;background:#e5e7eb;"></div>`
      return `
      <tr>
        <td style="padding:12px 0;vertical-align:middle;">${imgTag}</td>
        <td style="padding:12px 8px;vertical-align:middle;">
          <p style="margin:0;font-weight:600;color:#111;font-size:14px;">${p.productName}</p>
        </td>
        <td style="padding:12px 0;vertical-align:middle;text-align:right;">
          <a href="${reviewUrl}" style="display:inline-block;padding:8px 18px;background:#111827;color:#fff !important;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">Write Review</a>
        </td>
      </tr>`
    })
    .join("")

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Review your products</title>
</head>
<body style="margin:0; font-family: system-ui, -apple-system, sans-serif; background:#f5f5f5; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background:#fff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <h1 style="margin:0 0 8px; font-size: 22px; color:#111;">How was your order?</h1>
    <p style="margin:0 0 24px; color:#555; line-height: 1.5;">
      Hi ${customerName}, we hope you're enjoying your purchase from order <strong>#${orderNumber}</strong>.<br/>
      We'd love to hear your thoughts — your review helps other shoppers and helps us improve!
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;">
      ${productRows}
    </table>
    <p style="margin:24px 0 0; font-size: 13px; color:#999; text-align:center;">
      Thank you for shopping with PhotuPrint.
    </p>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Send product review request email.
 * @param {Object} job - ReviewEmailJob document (toEmail, customerName, orderNumber, products)
 * @returns {Promise<boolean>}
 */
export async function sendReviewRequestEmail(job) {
  const toEmail = job?.toEmail
  if (!toEmail || !String(toEmail).includes("@")) {
    console.warn("[reviewEmail] No valid email for order", job?.orderNumber)
    return false
  }

  const frontendOrigin = FRONTEND_ORIGIN
  const subject = `Review your order #${job.orderNumber} — PhotuPrint`
  const html = getReviewEmailHtml({
    customerName: job.customerName || "Customer",
    orderNumber: job.orderNumber,
    products: job.products || [],
    frontendOrigin,
  })

  let senderEmail = (process.env.BREVO_SMTP_LOGIN || process.env.SMTP_USER || "noreply@example.com").trim()
  const fromMatch = (process.env.SMTP_FROM || "").match(/<([^>]+)>/)
  if (fromMatch) senderEmail = fromMatch[1].trim()
  else if (!senderEmail.includes("@")) senderEmail = process.env.BREVO_SMTP_LOGIN || "noreply@example.com"
  const senderName = (process.env.SMTP_FROM || "").match(/^([^<]+)/)?.[1]?.trim() || process.env.SMTP_FROM_NAME || "PhotuPrint"

  const smtp = createEmailTransporter()
  if (!smtp) {
    console.warn("[reviewEmail] SMTP not configured; email skipped")
    return false
  }
  const { transporter, user } = smtp
  const fromEmail = process.env.SMTP_FROM || process.env.EMAIL_FROM || (user.includes("@") ? user : "noreply@example.com")
  const fromName = process.env.SMTP_FROM_NAME || process.env.EMAIL_FROM_NAME || "PhotuPrint"
  const fromAddr = fromEmail.includes("<") ? fromEmail : `${fromName} <${fromEmail}>`

  try {
    await transporter.sendMail({
      from: fromAddr,
      to: toEmail,
      subject,
      html,
      replyTo: process.env.SMTP_REPLY_TO || process.env.EMAIL_REPLY_TO || undefined,
    })
    console.log("[reviewEmail] Sent to", toEmail, "for order", job.orderNumber)
    return true
  } catch (sendErr) {
    console.error("[reviewEmail] Email failed:", sendErr.message)
    return false
  }
}
