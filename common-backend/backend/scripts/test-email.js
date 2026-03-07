#!/usr/bin/env node
/**
 * Test email sending - run: node backend/scripts/test-email.js [recipient@email.com]
 * Or newsletter: node backend/scripts/test-email.js --newsletter recipient@email.com
 * Helps debug why verification/newsletter emails aren't received.
 */
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import nodemailer from "nodemailer"
import { sendNewsletterWelcomeEmail } from "../utils/emailVerification.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, "..", ".env") })

const args = process.argv.slice(2)
const isNewsletter = args.includes("--newsletter")
const toEmail = args.find((a) => !a.startsWith("--")) || process.env.TEST_EMAIL || "kamal.online2006@gmail.com"

async function main() {
  console.log("\n=== Email Debug Script ===\n")
  console.log("Mode:", isNewsletter ? "Newsletter welcome" : "Verification")
  console.log("Recipient:", toEmail)
  console.log("FRONTEND_ORIGIN:", process.env.FRONTEND_ORIGIN || process.env.CLIENT_URL || "(not set, defaults to localhost:3000)")
  console.log("")

  if (isNewsletter) {
    console.log("Sending newsletter welcome email via sendNewsletterWelcomeEmail()...")
    const ok = await sendNewsletterWelcomeEmail(toEmail)
    if (ok) {
      console.log("\n✓ Newsletter welcome email sent successfully.")
    } else {
      console.log("\n✗ Newsletter welcome email was not sent. Check logs above for errors.")
      process.exit(1)
    }
    console.log("  Check inbox AND spam folder for:", toEmail)
    return
  }

  const host = (process.env.SMTP_HOST || "").trim()
  const isBrevoHost = host.includes("brevo.com")
  const hasBrevoCreds = process.env.BREVO_SMTP_LOGIN && process.env.BREVO_SMTP_KEY
  let user, pass
  if (isBrevoHost && hasBrevoCreds) {
    user = (process.env.BREVO_SMTP_LOGIN || "").trim()
    pass = (process.env.BREVO_SMTP_KEY || "").trim()
  } else {
    user = (process.env.SMTP_USER || process.env.BREVO_SMTP_LOGIN || "").trim()
    pass = (process.env.SMTP_PASS || "").trim()
    if (!pass || /your-|from-brevo|placeholder/i.test(pass)) pass = (process.env.BREVO_SMTP_KEY || "").trim()
  }

  console.log("SMTP Config:")
  console.log("  Host:", host || "(not set)")
  console.log("  Port:", process.env.SMTP_PORT || 587)
  console.log("  User:", user ? user.replace(/(.{3}).*(@.*)/, "$1***$2") : "(missing)")
  console.log("  Pass:", pass ? `${pass.substring(0, 8)}...` : "(missing)")
  console.log("")

  if (!user || !pass) {
    console.error("ERROR: Missing SMTP credentials. Set BREVO_SMTP_LOGIN and BREVO_SMTP_KEY in backend/.env")
    process.exit(1)
  }

  const port = Number(process.env.SMTP_PORT) || 587
  const secure = port === 465
  const transporter = nodemailer.createTransport({
    host: host || "smtp-relay.brevo.com",
    port,
    secure,
    auth: { user, pass },
  })

  console.log("1. Verifying SMTP connection...")
  try {
    await transporter.verify()
    console.log("   ✓ SMTP connection OK\n")
  } catch (err) {
    console.error("   ✗ SMTP verify failed:", err.message)
    if (err.code === "EAUTH") console.error("   → Check BREVO_SMTP_LOGIN and BREVO_SMTP_KEY (use SMTP key from Brevo SMTP tab, not API key)")
    process.exit(1)
  }

  const fromAddr = process.env.SMTP_FROM || process.env.EMAIL_FROM || (user.includes("@") ? `Photuprint <${user}>` : user)
  const testLink = `${process.env.FRONTEND_ORIGIN || process.env.CLIENT_URL || "http://localhost:3001"}/verify-email?token=test-token-123`

  console.log("2. Sending test email...")
  console.log("   From:", fromAddr)
  console.log("   To:", toEmail)
  console.log("   Link:", testLink)
  console.log("")

  try {
    const info = await transporter.sendMail({
      from: fromAddr,
      to: toEmail,
      subject: "[Test] Photuprint verification email",
      html: `
        <p>This is a test email from your Photuprint backend.</p>
        <p>If you receive this, SMTP is working. Check your <strong>Spam/Junk</strong> folder if verification emails don't appear in Inbox.</p>
        <p><a href="${testLink}">Test verification link</a></p>
        <p>Sent at: ${new Date().toISOString()}</p>
      `,
    })
    console.log("   ✓ Email sent successfully!")
    console.log("   Message ID:", info.messageId)
    console.log("")
    console.log("Next steps:")
    console.log("  1. Check inbox AND spam/junk folder for:", toEmail)
    console.log("  2. If in spam: Add sender to contacts, or authenticate domain in Brevo")
    console.log("  3. Brevo dashboard: https://app.brevo.com → Statistics → Transactional to see delivery status")
    console.log("")
  } catch (err) {
    console.error("   ✗ Send failed:", err.message)
    if (err.response) console.error("   Response:", err.response)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
