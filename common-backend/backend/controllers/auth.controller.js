import User from "../models/user.model.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"

const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  })
}

export const register = async (req, res) => {
  const { name, email, password } = req.body
  try {
    const existingUser = await User.findOne({ email })
    if (existingUser) return res.status(400).json({ msg: "User already exists" })

    const user = await User.create({ name, email, password })
    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      token: generateToken(user),
    })
  } catch (err) {
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
        lockedUntil: user.lockedUntil
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

    // Successful login - reset failed attempts and update last login
    if (user.resetFailedLogins) {
      await user.resetFailedLogins()
    } else {
      user.lastLoginAt = new Date()
      await user.save()
    }

    // Build permissions array for response
    let permissions = []
    if (user.role === 'super_admin') {
      permissions = ['*'] // Wildcard for all permissions
    } else {
      permissions = user.permissions || []
    }

    res.json({
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        username: user.username,
        role: user.role, 
        picture: user.picture,
        permissions,
        accessibleWebsites: user.accessibleWebsites || [],
        isSuperAdmin: user.role === 'super_admin'
      },
      token: generateToken(user),
    })
  } catch (err) {
    console.error("Login error:", err)
    res.status(500).json({ msg: err.message })
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
    const websiteId = req.headers['x-website-id'] || req.headers['X-Website-Id'] || bodyWebsiteId
    console.log('[Google Auth] Received data:', {
      headers: {
        'x-website-id': req.headers['x-website-id'],
        'X-Website-Id': req.headers['X-Website-Id']
      },
      bodyWebsiteId,
      finalWebsiteId: websiteId
    })
    
    let websiteObjectId = null

    // Validate website ID if provided
    if (websiteId) {
      if (!mongoose.Types.ObjectId.isValid(websiteId)) {
        console.error('[Google Auth] Invalid website ID format:', websiteId)
        return res.status(400).json({ 
          msg: "Invalid website ID format",
          code: "INVALID_WEBSITE_ID"
        })
      }
      websiteObjectId = new mongoose.Types.ObjectId(websiteId)
      console.log('[Google Auth] Valid website ID:', websiteObjectId.toString())
    } else {
      console.warn('[Google Auth] No website ID provided in headers or body')
    }

    // Check if user already exists
    let user = await User.findOne({ $or: [{ email }, { googleId }] })

    if (user) {
      console.log('[Google Auth] Existing user found:', {
        id: user._id,
        email: user.email,
        role: user.role,
        currentWebsite: user.website
      })
      
      // User exists - update Google OAuth info if needed
      if (!user.googleId) {
        user.googleId = googleId
        user.picture = picture || user.picture
      }
      
      // Set website for customer role if not already set and websiteId is provided
      if (websiteObjectId && user.role === 'customer' && !user.website) {
        console.log('[Google Auth] Setting website for existing customer:', websiteObjectId.toString())
        user.website = websiteObjectId
      } else if (websiteObjectId && user.role === 'customer' && user.website) {
        console.log('[Google Auth] Customer already has website:', user.website.toString())
      }
      
      await user.save()
      console.log('[Google Auth] User saved with website:', user.website)
      
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
      // Create new user with Google OAuth
      const userData = {
        name,
        email,
        googleId,
        picture: picture || null,
        password: undefined, // No password for Google OAuth users
      }
      
      // Set website for new users if websiteId is provided (for all roles)
      if (websiteObjectId) {
        console.log('[Google Auth] Setting website for new user:', websiteObjectId.toString())
        userData.website = websiteObjectId
      } else {
        console.warn('[Google Auth] Creating new user without website ID')
      }
      
      user = await User.create(userData)
      console.log('[Google Auth] New user created with website:', user.website)
    }

    // Build permissions array for response
    let permissions = []
    if (user.role === 'super_admin') {
      permissions = ['*'] // Wildcard for all permissions
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
        isSuperAdmin: user.role === 'super_admin'
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
