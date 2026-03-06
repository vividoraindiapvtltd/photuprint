import express from "express"
import { register, login, googleAuth } from "../controllers/auth.controller.js"
import User from "../models/user.model.js"
import Permission from "../models/permission.model.js"

const router = express.Router()

router.post("/register", register)
router.post("/login", login)
router.post("/google", googleAuth)

/**
 * One-time endpoint to CREATE or FIX super admin (with password)
 * Use this when you need to create admin@photuprint.com or reset the password.
 * POST /api/auth/create-super-admin
 * Body: { email: "admin@photuprint.com", password: "YourPassword123", name: "Super Admin", secretKey: "setup-photuprint-2024" }
 */
router.post("/create-super-admin", async (req, res) => {
  try {
    const { email, password, name, secretKey } = req.body

    if (secretKey !== "setup-photuprint-2024") {
      return res.status(403).json({ msg: "Invalid setup key" })
    }

    if (!email) {
      return res.status(400).json({ msg: "Email is required" })
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ msg: "Password is required and must be at least 6 characters" })
    }

    const emailLower = email.toLowerCase().trim()
    let user = await User.findOne({ email: emailLower })

    if (user) {
      // Update existing user: set password (will be hashed by pre-save), role, isActive
      user.password = password
      user.role = 'super_admin'
      user.isActive = true
      user.deleted = false
      user.permissions = []
      user.failedLoginAttempts = 0
      user.lockedUntil = null
      if (name) user.name = name
      await user.save()
      return res.json({
        msg: "Super Admin updated. You can now login with this email and password.",
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      })
    }

    // Create new user
    user = await User.create({
      name: name || "Super Admin",
      email: emailLower,
      password,
      role: 'super_admin',
      isActive: true,
      permissions: [],
    })

    // Seed permissions if needed
    try {
      const Permission = (await import("../models/permission.model.js")).default
      const existingCount = await Permission.countDocuments()
      if (existingCount === 0) {
        await Permission.seedDefaultPermissions()
      }
    } catch (permError) {
      console.error("Error seeding permissions:", permError)
    }

    // Create default website if none exist (so super admin can select one)
    let defaultWebsiteCreated = false
    try {
      const Website = (await import("../models/website.model.js")).default
      const websiteCount = await Website.countDocuments()
      if (websiteCount === 0) {
        await Website.create({
          name: "PhotuPrint",
          domain: "photuprint.com",
          description: "Default website",
          isActive: true,
          deleted: false,
        })
        defaultWebsiteCreated = true
      }
    } catch (websiteError) {
      console.error("Error creating default website:", websiteError)
    }

    res.status(201).json({
      msg: "Super Admin created. You can now login with this email and password." + (defaultWebsiteCreated ? " A default website (PhotuPrint) was also created." : ""),
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    })
  } catch (error) {
    console.error("Create super admin error:", error)
    res.status(500).json({ msg: error.message })
  }
})

/**
 * One-time endpoint to create default website when none exist
 * POST /api/auth/create-default-website
 * Body: { secretKey: "setup-photuprint-2024" }
 */
router.post("/create-default-website", async (req, res) => {
  try {
    const { secretKey } = req.body
    if (secretKey !== "setup-photuprint-2024") {
      return res.status(403).json({ msg: "Invalid setup key" })
    }
    const Website = (await import("../models/website.model.js")).default
    const websiteCount = await Website.countDocuments()
    if (websiteCount > 0) {
      return res.json({ msg: "Websites already exist. No default website created.", count: websiteCount })
    }
    const website = await Website.create({
      name: "PhotuPrint",
      domain: "photuprint.com",
      description: "Default website",
      isActive: true,
      deleted: false,
    })
    res.status(201).json({
      msg: "Default website created. You can now select it after login.",
      website: { id: website._id, name: website.name, domain: website.domain },
    })
  } catch (error) {
    console.error("Create default website error:", error)
    res.status(500).json({ msg: error.message })
  }
})

/**
 * One-time setup endpoint to configure super admin and seed permissions (upgrades existing user only)
 * POST /api/auth/setup-super-admin
 * Body: { email: "admin@photuprint.com", secretKey: "setup-photuprint-2024" }
 */
router.post("/setup-super-admin", async (req, res) => {
  try {
    const { email, secretKey } = req.body
    
    // Simple security check - require a secret key
    if (secretKey !== "setup-photuprint-2024") {
      return res.status(403).json({ msg: "Invalid setup key" })
    }
    
    if (!email) {
      return res.status(400).json({ msg: "Email is required" })
    }
    
    // Find the user
    const user = await User.findOne({ email: email.toLowerCase() })
    
    if (!user) {
      return res.status(404).json({ msg: `User with email ${email} not found` })
    }
    
    // Update to super_admin
    const wasAlreadySuperAdmin = user.role === 'super_admin'
    user.role = 'super_admin'
    user.isActive = true
    user.permissions = [] // Super admin doesn't need specific permissions
    await user.save()
    
    // Seed default permissions
    let permissionsSeeded = 0
    try {
      const existingCount = await Permission.countDocuments()
      if (existingCount === 0) {
        permissionsSeeded = await Permission.seedDefaultPermissions()
      } else {
        permissionsSeeded = existingCount
      }
    } catch (permError) {
      console.error("Error seeding permissions:", permError)
    }
    
    res.json({
      msg: wasAlreadySuperAdmin 
        ? "User was already a Super Admin" 
        : "User successfully set as Super Admin",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      permissionsCount: permissionsSeeded
    })
  } catch (error) {
    console.error("Setup super admin error:", error)
    res.status(500).json({ msg: error.message })
  }
})

export default router
