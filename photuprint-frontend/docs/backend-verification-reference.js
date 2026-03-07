/**
 * Backend reference: email verification flow
 * Integrate these routes and helpers into your existing Node/Express backend.
 * Uses: Resend (free tier) for email, crypto for token, bcrypt for hashing.
 *
 * npm install resend bcrypt
 * Env: RESEND_API_KEY, FRONTEND_ORIGIN, JWT_SECRET (and DB connection)
 */

const crypto = require("crypto")
const bcrypt = require("bcrypt")
const { Resend } = require("resend")

const resend = new Resend(process.env.RESEND_API_KEY)
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000"
const TOKEN_EXPIRY_HOURS = 24

// ---------- Helpers ----------

function generateToken() {
  return crypto.randomBytes(32).toString("hex")
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

function getVerificationEmailHtml(verificationLink) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Verify your email</title></head>
<body style="margin:0; font-family: system-ui, sans-serif; background:#f5f5f5; padding: 24px;">
  <div style="max-width: 480px; margin: 0 auto; background:#fff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <h1 style="margin:0 0 16px; font-size: 22px; color:#111;">Verify your email</h1>
    <p style="margin:0 0 24px; color:#444; line-height: 1.5;">Thanks for signing up. Click the button below to verify your email and activate your account.</p>
    <p style="margin:0 0 24px;">
      <a href="${verificationLink}" style="display: inline-block; padding: 12px 24px; background:#2563eb; color:#fff; text-decoration: none; border-radius: 8px; font-weight: 600;">Verify email address</a>
    </p>
    <p style="margin:0; font-size: 13px; color:#666;">This link expires in ${TOKEN_EXPIRY_HOURS} hours. If you didn't create an account, you can ignore this email.</p>
  </div>
</body>
</html>
  `.trim()
}

async function sendVerificationEmail(toEmail, token) {
  const verificationLink = `${FRONTEND_ORIGIN}/verify-email?token=${token}`
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM || "Onboarding <onboarding@resend.dev>",
    to: toEmail,
    subject: "Verify your email address",
    html: getVerificationEmailHtml(verificationLink),
  })
  if (error) throw new Error(error.message)
}

// ---------- DB shape (example – adapt to your DB) ----------
// User: { id, name, email, passwordHash, emailVerified: false, status: 'pending',
//         verificationTokenHash, verificationTokenExpiresAt }

// ---------- POST /auth/register ----------
async function handleRegister(req, res) {
  const { name, email, password } = req.body
  if (!name || !email || !password) {
    return res.status(400).json({ msg: "Name, email and password are required." })
  }
  if (password.length < 6) {
    return res.status(400).json({ msg: "Password must be at least 6 characters." })
  }

  // Check existing user (pseudo – replace with your DB)
  const existing = await findUserByEmail(email)
  if (existing && existing.emailVerified) {
    return res.status(400).json({ msg: "An account with this email already exists." })
  }

  const token = generateToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await createUser({
    name,
    email,
    passwordHash,
    emailVerified: false,
    status: "pending",
    verificationTokenHash: tokenHash,
    verificationTokenExpiresAt: expiresAt,
  })

  await sendVerificationEmail(email, token)

  res.status(200).json({
    msg: "Verification email sent to your email address.",
    email,
  })
}

// ---------- POST /auth/verify-email ----------
async function handleVerifyEmail(req, res) {
  const { token } = req.body
  if (!token) {
    return res.status(400).json({ msg: "Invalid or missing verification link." })
  }

  const tokenHash = hashToken(token)
  const user = await findUserByVerificationToken(tokenHash)
  if (!user) {
    return res.status(400).json({ msg: "This link is invalid or has expired." })
  }
  if (new Date() > new Date(user.verificationTokenExpiresAt)) {
    return res.status(400).json({ msg: "This link is invalid or has expired." })
  }

  await updateUser(user.id, {
    emailVerified: true,
    status: "active",
    verificationTokenHash: null,
    verificationTokenExpiresAt: null,
  })

  const jwt = generateJWT(user)
  const userResponse = sanitizeUser(user)
  res.status(200).json({ user: userResponse, token: jwt })
}

// ---------- POST /auth/resend-verification ----------
async function handleResendVerification(req, res) {
  const { email } = req.body
  if (!email) {
    return res.status(400).json({ msg: "Email is required." })
  }

  const user = await findUserByEmail(email)
  if (!user || user.emailVerified) {
    return res.status(400).json({ msg: "No pending registration found for this email." })
  }

  const token = generateToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)

  await updateUser(user.id, {
    verificationTokenHash: tokenHash,
    verificationTokenExpiresAt: expiresAt,
  })

  await sendVerificationEmail(email, token)
  res.status(200).json({ msg: "Verification email sent." })
}

// ---------- POST /auth/login (add check) ----------
async function handleLogin(req, res) {
  const { email, password } = req.body
  const user = await findUserByEmail(email)
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ msg: "Invalid email or password." })
  }
  if (!user.emailVerified) {
    return res.status(403).json({ msg: "Please verify your email before signing in." })
  }
  const jwt = generateJWT(user)
  res.status(200).json({ user: sanitizeUser(user), token: jwt })
}

// ---------- Placeholders – replace with your DB and JWT ----------
async function findUserByEmail(email) {
  return null
}
async function findUserByVerificationToken(tokenHash) {
  return null
}
async function createUser(data) {
  return { id: "1", ...data }
}
async function updateUser(id, data) {
  return {}
}
function generateJWT(user) {
  return "eyJ..."
}
function sanitizeUser(user) {
  const { passwordHash, verificationTokenHash, ...rest } = user
  return rest
}

module.exports = {
  handleRegister,
  handleVerifyEmail,
  handleResendVerification,
  handleLogin,
  sendVerificationEmail,
  getVerificationEmailHtml,
  generateToken,
  hashToken,
}
