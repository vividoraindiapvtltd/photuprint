import crypto from "crypto"
import User from "../models/user.model.js"
import PendingRegistration from "../models/pendingRegistration.model.js"
import OtpSession from "../models/otpSession.model.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { sendVerificationEmail } from "../utils/emailVerification.js"
import { normalizePhone, sendSms } from "../utils/smsService.js"

const TOKEN_EXPIRY_HOURS = 24

const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  })
}

function createVerificationToken() {
  return crypto.randomBytes(32).toString("hex")
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

function userToResponse(user) {
  const permissions = user.role === "super_admin" ? ["*"] : user.permissions || []
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    username: user.username,
    role: user.role,
    picture: user.picture,
    permissions,
    accessibleWebsites: user.accessibleWebsites || [],
    isSuperAdmin: user.role === "super_admin",
  }
}

export const register = async (req, res) => {
  const { name, email, password, mobile, returnPath } = req.body
  try {
    if (!name || !String(name).trim()) {
      return res.status(400).json({ msg: "Name is required", code: "NAME_REQUIRED" })
    }
    if (!email || !String(email).trim()) {
      return res.status(400).json({ msg: "Email is required", code: "EMAIL_REQUIRED" })
    }
    if (!password || String(password).length < 8) {
      return res.status(400).json({ msg: "Password must be at least 8 characters", code: "PASSWORD_REQUIRED" })
    }
    if (!/[A-Z]/.test(String(password))) {
      return res.status(400).json({ msg: "Password must contain at least 1 uppercase letter", code: "PASSWORD_WEAK" })
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(String(password))) {
      return res.status(400).json({ msg: "Password must contain at least 1 special character", code: "PASSWORD_WEAK" })
    }
    const emailLower = String(email).trim().toLowerCase()

    const existingUser = await User.findOne({ email: emailLower })
    if (existingUser) {
      return res.status(400).json({ msg: "User already exists", code: "USER_EXISTS" })
    }

    const token = createVerificationToken()
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)

    const pendingData = {
      email: emailLower,
      name: String(name).trim(),
      password,
      phone: mobile != null ? String(mobile).trim() : null,
      tokenHash,
      expiresAt,
    }
    await PendingRegistration.findOneAndUpdate({ email: emailLower }, { $set: pendingData }, { upsert: true, new: true })

    let emailSent = false
    try {
      await sendVerificationEmail(emailLower, token, returnPath)
      emailSent = true
    } catch (emailErr) {
      console.error("Register: verification email failed:", emailErr.message)
      if (emailErr.response) console.error("SMTP response:", emailErr.response)
      if (emailErr.code) console.error("Error code:", emailErr.code)
      console.error("Full error:", emailErr)
    }

    res.status(200).json({
      msg: emailSent ? "Verification email sent to your email address." : "Registration saved but we could not send the verification email. Please use Resend verification or try again later.",
      email: emailLower,
      emailSent,
    })
  } catch (err) {
    console.error("Register error:", err)
    res.status(500).json({ msg: err.message })
  }
}

export const login = async (req, res) => {
  const { email, username, password } = req.body

  try {
    // Allow login with either email or username
    let user
    if (email) {
      user = await User.findOne({ email: email.toLowerCase() })
    } else if (username) {
      user = await User.findOne({ username: username.toLowerCase() })
    }

    if (!user) {
      return res.status(400).json({ msg: "Invalid credentials", code: "INVALID_CREDENTIALS" })
    }

    // Check if account is deleted
    if (user.deleted) {
      return res.status(403).json({ msg: "This account has been deleted", code: "ACCOUNT_DELETED" })
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({ msg: "Your account has been deactivated. Please contact administrator.", code: "ACCOUNT_INACTIVE" })
    }

    // Check if account is locked
    if (user.isLocked && user.isLocked()) {
      const remainingTime = Math.ceil((user.lockedUntil - new Date()) / 60000)
      return res.status(423).json({
        msg: `Account is locked. Please try again in ${remainingTime} minutes.`,
        code: "ACCOUNT_LOCKED",
        lockedUntil: user.lockedUntil,
      })
    }

    // Check if user is a Google OAuth user trying to login with password
    if (user.googleId && !password) {
      return res.status(400).json({ msg: "Please sign in with Google", code: "USE_GOOGLE_AUTH" })
    }

    // Check if user is not a Google OAuth user but no password provided
    if (!user.googleId && !password) {
      return res.status(400).json({ msg: "Password is required", code: "PASSWORD_REQUIRED" })
    }

    const passwordMatch = await user.matchPassword(password)

    if (!passwordMatch) {
      // Record failed login attempt
      if (user.recordFailedLogin) {
        await user.recordFailedLogin()
      }
      return res.status(400).json({ msg: "Invalid credentials", code: "INVALID_CREDENTIALS" })
    }

    // Admin-CMS users (super_admin, admin, editor) do not require email verification; customers do
    const adminCmsRoles = ["super_admin", "admin", "editor"]
    if (!user.emailVerified && !adminCmsRoles.includes(user.role)) {
      return res.status(403).json({ msg: "Please verify your email before signing in.", code: "EMAIL_NOT_VERIFIED" })
    }

    // Successful login - reset failed attempts and update last login
    if (user.resetFailedLogins) {
      await user.resetFailedLogins()
    } else {
      user.lastLoginAt = new Date()
      await user.save()
    }

    // Build permissions array for response
    let permissions = []
    if (user.role === "super_admin") {
      permissions = ["*"] // Wildcard for all permissions
    } else {
      permissions = user.permissions || []
    }

    res.json({
      user: userToResponse(user),
      token: generateToken(user),
    })
  } catch (err) {
    console.error("Login error:", err)
    res.status(500).json({ msg: err.message })
  }
}

export const verifyEmail = async (req, res) => {
  let token = req.body?.token ?? req.query?.token
  if (process.env.NODE_ENV !== "production") {
    console.log("[verifyEmail] Received token:", token ? `${token.substring(0, 8)}...` : "(missing)")
  }
  try {
    if (!token || typeof token !== "string") {
      console.warn("[verifyEmail] 400: token missing or invalid type")
      return res.status(400).json({ msg: "This link is invalid or has expired.", code: "TOKEN_MISSING" })
    }
    try {
      token = decodeURIComponent(token).trim()
    } catch {
      token = String(token).trim()
    }
    if (!token) {
      return res.status(400).json({ msg: "This link is invalid or has expired.", code: "TOKEN_MISSING" })
    }

    const tokenHash = hashToken(token)
    const pending = await PendingRegistration.findOne({ tokenHash })
    if (!pending) {
      console.warn("[verifyEmail] 400: no pending registration for token")
      return res.status(400).json({ msg: "This link is invalid or has expired.", code: "TOKEN_INVALID" })
    }
    if (!pending.expiresAt || new Date() > new Date(pending.expiresAt)) {
      await PendingRegistration.deleteOne({ _id: pending._id }).catch(() => {})
      console.warn("[verifyEmail] 400: token expired for", pending.email)
      return res.status(400).json({ msg: "This link has expired. Please request a new verification email.", code: "TOKEN_EXPIRED" })
    }

    let user = await User.findOne({ email: pending.email })
    if (user?.emailVerified) {
      await PendingRegistration.deleteOne({ _id: pending._id }).catch(() => {})
      return res.status(200).json({ user: userToResponse(user), token: generateToken(user), msg: "Email already verified." })
    }

    if (!user) {
      user = await User.create({
        name: pending.name,
        email: pending.email,
        password: pending.password,
        phone: pending.phone || undefined,
        emailVerified: true,
        isActive: true,
      })
    } else {
      user.emailVerified = true
      await user.save()
    }

    await PendingRegistration.deleteOne({ _id: pending._id })

    res.status(200).json({
      user: userToResponse(user),
      token: generateToken(user),
    })
  } catch (err) {
    console.error("Verify email error:", err)
    if (err.code === 11000) {
      return res.status(400).json({ msg: "This email is already registered.", code: "EMAIL_EXISTS" })
    }
    res.status(500).json({ msg: err.message })
  }
}

export const resendVerification = async (req, res) => {
  const { email } = req.body
  try {
    if (!email || !String(email).trim()) {
      return res.status(400).json({ msg: "Email is required." })
    }
    const emailLower = String(email).trim().toLowerCase()
    const pending = await PendingRegistration.findOne({ email: emailLower })
    if (!pending) {
      return res.status(400).json({ msg: "No pending registration found for this email." })
    }
    if (pending.expiresAt && new Date() > new Date(pending.expiresAt)) {
      await PendingRegistration.deleteOne({ _id: pending._id }).catch(() => {})
      return res.status(400).json({ msg: "This link has expired. Please register again." })
    }
    const token = createVerificationToken()
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)
    pending.tokenHash = tokenHash
    pending.expiresAt = expiresAt
    await pending.save()

    let emailSent = false
    try {
      await sendVerificationEmail(emailLower, token)
      emailSent = true
    } catch (emailErr) {
      console.error("Resend verification: email failed:", emailErr.message)
      if (emailErr.code) console.error("Error code:", emailErr.code)
    }

    if (emailSent) {
      return res.status(200).json({ msg: "Verification email sent.", emailSent: true })
    }
    res.status(200).json({
      msg: "We could not send the verification email. Please check your SMTP settings or try again later.",
      emailSent: false,
    })
  } catch (err) {
    console.error("Resend verification error:", err)
    res.status(500).json({ msg: err.message || "Resend verification failed." })
  }
}

// Google OAuth login/register
export const googleAuth = async (req, res) => {
  try {
    const { googleId, email, name, picture, websiteId: bodyWebsiteId } = req.body

    if (!googleId || !email || !name) {
      return res.status(400).json({ msg: "Missing required Google OAuth data" })
    }

    // Extract website ID from headers first, then fallback to request body (for multi-tenant support)
    const websiteId = req.headers["x-website-id"] || req.headers["X-Website-Id"] || bodyWebsiteId
    console.log("[Google Auth] Received data:", {
      headers: {
        "x-website-id": req.headers["x-website-id"],
        "X-Website-Id": req.headers["X-Website-Id"],
      },
      bodyWebsiteId,
      finalWebsiteId: websiteId,
    })

    let websiteObjectId = null

    // Validate website ID if provided
    if (websiteId) {
      if (!mongoose.Types.ObjectId.isValid(websiteId)) {
        console.error("[Google Auth] Invalid website ID format:", websiteId)
        return res.status(400).json({
          msg: "Invalid website ID format",
          code: "INVALID_WEBSITE_ID",
        })
      }
      websiteObjectId = new mongoose.Types.ObjectId(websiteId)
      console.log("[Google Auth] Valid website ID:", websiteObjectId.toString())
    } else {
      console.warn("[Google Auth] No website ID provided in headers or body")
    }

    // Check if user already exists
    let user = await User.findOne({ $or: [{ email }, { googleId }] })

    if (user) {
      console.log("[Google Auth] Existing user found:", {
        id: user._id,
        email: user.email,
        role: user.role,
        currentWebsite: user.website,
      })

      // User exists - update Google OAuth info if needed; treat as email verified when signing in with Google
      if (!user.googleId) {
        user.googleId = googleId
        user.picture = picture || user.picture
      }
      user.emailVerified = true

      // Set website for customer role if not already set and websiteId is provided
      if (websiteObjectId && user.role === "customer" && !user.website) {
        console.log("[Google Auth] Setting website for existing customer:", websiteObjectId.toString())
        user.website = websiteObjectId
      } else if (websiteObjectId && user.role === "customer" && user.website) {
        console.log("[Google Auth] Customer already has website:", user.website.toString())
      }

      await user.save()
      console.log("[Google Auth] User saved with website:", user.website)

      // Check if account is deleted
      if (user.deleted) {
        return res.status(403).json({ msg: "This account has been deleted", code: "ACCOUNT_DELETED" })
      }

      // Check if account is active
      if (!user.isActive) {
        return res.status(403).json({ msg: "Your account has been deactivated. Please contact administrator.", code: "ACCOUNT_INACTIVE" })
      }

      // Update last login
      user.lastLoginAt = new Date()
      await user.save()
    } else {
      // Create new user with Google OAuth (email already verified by Google)
      const userData = {
        name,
        email,
        googleId,
        picture: picture || null,
        password: undefined,
        emailVerified: true,
      }

      // Set website for new users if websiteId is provided (for all roles)
      if (websiteObjectId) {
        console.log("[Google Auth] Setting website for new user:", websiteObjectId.toString())
        userData.website = websiteObjectId
      } else {
        console.warn("[Google Auth] Creating new user without website ID")
      }

      user = await User.create(userData)
      console.log("[Google Auth] New user created with website:", user.website)
    }

    // Build permissions array for response
    let permissions = []
    if (user.role === "super_admin") {
      permissions = ["*"] // Wildcard for all permissions
    } else {
      permissions = user.permissions || []
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        picture: user.picture,
        permissions,
        accessibleWebsites: user.accessibleWebsites || [],
        isSuperAdmin: user.role === "super_admin",
      },
      token: generateToken(user),
    })
  } catch (err) {
    console.error("Google OAuth error:", err)
    if (err.code === 11000) {
      return res.status(400).json({ msg: "User with this email or Google ID already exists" })
    }
    res.status(500).json({ msg: err.message })
  }
}

const OTP_EXPIRY_MINUTES = 10
const OTP_RATE_LIMIT_SECONDS = 60

function hashOtp(otp) {
  return crypto.createHash("sha256").update(String(otp).trim()).digest("hex")
}

/**
 * POST /api/auth/send-otp
 * Body: { phone }
 * Sends 6-digit OTP via SMS. Does not reveal whether the number is registered.
 */
export const sendOtp = async (req, res) => {
  try {
    const { phone } = req.body
    if (!phone || typeof phone !== "string") {
      return res.status(400).json({ msg: "Phone number is required", code: "PHONE_REQUIRED" })
    }
    const normalized = normalizePhone(phone)
    if (!normalized) {
      return res.status(400).json({ msg: "Please enter a valid 10-digit Indian mobile number", code: "INVALID_PHONE" })
    }

    const now = new Date()
    const recentCutoff = new Date(now.getTime() - OTP_RATE_LIMIT_SECONDS * 1000)
    const recent = await OtpSession.findOne({ phone: normalized, createdAt: { $gte: recentCutoff } })
    if (recent) {
      return res.status(429).json({
        msg: "Please wait a minute before requesting another OTP",
        code: "OTP_RATE_LIMIT",
      })
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const otpHash = hashOtp(otp)
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000)

    await OtpSession.deleteMany({ phone: normalized })
    await OtpSession.create({ phone: normalized, otpHash, expiresAt })

    const smsBody = `Your PhotuPrint login OTP is ${otp}. Valid for ${OTP_EXPIRY_MINUTES} min. Do not share.`
    console.log("[sendOtp] Calling sendSms for", normalized, "| FAST2SMS_API_KEY set:", !!(process.env.FAST2SMS_API_KEY || "").trim())
    const sent = await sendSms(normalized, smsBody)
    console.log("[sendOtp] sendSms returned:", sent)

    if (!sent) {
      console.warn("[sendOtp] SMS was NOT sent. Phone:", normalized)
      const isProduction = process.env.NODE_ENV === "production"
      const response = {
        msg: isProduction
          ? "OTP sent to your mobile number"
          : "OTP generated (SMS delivery failed — use devOtp below to verify)",
        code: "OTP_SENT",
      }
      if (!isProduction) {
        response.devOtp = otp
        response.devNote = "SMS not delivered. Use devOtp to verify."
      }
      return res.status(200).json(response)
    }

    res.status(200).json({ msg: "OTP sent to your mobile number", code: "OTP_SENT" })
  } catch (err) {
    console.error("Send OTP error:", err)
    res.status(500).json({ msg: "Failed to send OTP. Please try again.", code: "SERVER_ERROR" })
  }
}

/**
 * POST /api/auth/verify-otp
 * Body: { phone, otp }
 * Verifies OTP and returns user + token if account exists for this phone.
 */
export const verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body
    if (!phone || typeof phone !== "string") {
      return res.status(400).json({ msg: "Phone number is required", code: "PHONE_REQUIRED" })
    }
    if (!otp || String(otp).trim().length < 4) {
      return res.status(400).json({ msg: "Please enter the OTP you received", code: "OTP_REQUIRED" })
    }

    const normalized = normalizePhone(phone)
    if (!normalized) {
      return res.status(400).json({ msg: "Invalid phone number", code: "INVALID_PHONE" })
    }

    const now = new Date()
    const session = await OtpSession.findOne({ phone: normalized, expiresAt: { $gt: now } }).sort({ createdAt: -1 })
    if (!session) {
      return res.status(401).json({ msg: "OTP expired or invalid. Please request a new one.", code: "OTP_INVALID" })
    }

    const otpHash = hashOtp(otp)
    if (session.otpHash !== otpHash) {
      return res.status(401).json({ msg: "Invalid OTP. Please check and try again.", code: "OTP_INVALID" })
    }

    await OtpSession.deleteOne({ _id: session._id })

    const user = await User.findOne({
      deleted: { $ne: true },
      $or: [{ phone: normalized }, { phone: "91" + normalized }, { phone: "+91" + normalized }],
    })
    if (!user) {
      return res.status(404).json({
        msg: "No account linked to this number. Please create an account with email first or add this number in your profile.",
        code: "NO_ACCOUNT",
      })
    }
    if (!user.isActive) {
      return res.status(403).json({ msg: "Your account has been deactivated.", code: "ACCOUNT_INACTIVE" })
    }

    if (user.resetFailedLogins) {
      await user.resetFailedLogins()
    } else {
      user.lastLoginAt = new Date()
      await user.save()
    }

    const permissions = user.role === "super_admin" ? ["*"] : user.permissions || []
    res.json({
      user: userToResponse(user),
      token: generateToken(user),
    })
  } catch (err) {
    console.error("Verify OTP error:", err)
    res.status(500).json({ msg: "Something went wrong. Please try again.", code: "SERVER_ERROR" })
  }
}
