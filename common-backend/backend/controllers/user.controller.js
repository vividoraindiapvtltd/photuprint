import User from "../models/user.model.js"
import bcrypt from "bcryptjs"
import mongoose from "mongoose"

// Get all users
export const getUsers = async (req, res) => {
  try {
    // Multi-tenant: Filter by website when websiteId is provided
    // If websiteId is provided (even for super admins), filter by that website
    // Super admins without websiteId can see all users
    const isSuperAdmin = req.user && req.user.role === "admin"

    // Debug: Log received headers
    console.log("🔍 Backend: Received headers:", {
      "x-website-id": req.headers["x-website-id"],
      "X-Website-Id": req.headers["X-Website-Id"],
      "req.websiteId": req.websiteId,
      "req.tenant": req.tenant ? req.tenant._id : null,
    })

    const { search, showInactive, includeDeleted, role } = req.query
    let query = {}

    // Filter by website when websiteId is provided (applies to both super admins and regular admins)
    if (req.websiteId) {
      // When a website is selected, show ONLY users from that website
      // Handle both ObjectId and string formats (users might have website stored as either)
      const websiteIdStr = req.websiteId.toString ? req.websiteId.toString() : String(req.websiteId)
      const websiteIdObj = req.websiteId instanceof mongoose.Types.ObjectId ? req.websiteId : mongoose.Types.ObjectId.isValid(req.websiteId) ? new mongoose.Types.ObjectId(req.websiteId) : req.websiteId

      // Query for users where website matches (as ObjectId or string)
      // This handles cases where website might be stored as string or ObjectId in the database
      query.$or = [
        { website: websiteIdObj }, // Match as ObjectId
        { website: websiteIdStr }, // Match as string
      ]

      console.log("🔍 Backend: Filtering users by website:", websiteIdStr)
      console.log("🔍 Backend: Query will match website as ObjectId or string")
    } else if (!isSuperAdmin) {
      // If no websiteId and not super admin, this shouldn't happen (middleware should catch it)
      // But as a fallback, show only users without website assignment
      query.website = null
    } else {
      // If super admin and no websiteId, show all users (query remains empty)
      console.log("🔍 Backend: Super admin - showing all users (no website filter)")
    }

    // Filter by active status
    if (showInactive !== "true") {
      query.isActive = true
    }

    // Filter deleted items
    if (includeDeleted !== "true") {
      query.deleted = false
    }

    // Filter by role
    if (role && ["admin", "customer", "editor"].includes(role)) {
      query.role = role
    }

    // Search functionality
    if (search) {
      const searchConditions = {
        $or: [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }, { phone: { $regex: search, $options: "i" } }],
      }

      // Combine search with existing query using $and
      // If query already has $or (from website filter), combine properly
      if (query.$or) {
        // Website filter uses $or, so combine with $and
        query = {
          $and: [{ $or: query.$or }, searchConditions],
        }
      } else if (Object.keys(query).length > 0) {
        query = {
          $and: [query, searchConditions],
        }
      } else {
        // If no existing query, just use search
        query = searchConditions
      }
    }

    // Log query for debugging (ObjectId will show as string in JSON)
    console.log("🔍 Final MongoDB query:", JSON.stringify(query, null, 2))
    console.log("🔍 Query website value type:", query.website ? (query.website instanceof mongoose.Types.ObjectId ? "ObjectId" : typeof query.website) : "null")

    const users = await User.find(query)
      .select("-password")
      .populate("website", "name domain") // Populate website with name and domain
      .sort({ createdAt: -1 })

    console.log("🔍 Found users:", users.length)
    if (users.length > 0 && query.website) {
      const websiteIds = users.map((u) => (u.website ? (u.website._id ? u.website._id.toString() : u.website.toString()) : "null"))
      const uniqueWebsites = [...new Set(websiteIds)]
      console.log("🔍 Users belong to websites:", uniqueWebsites)
    }

    res.json(users)
  } catch (error) {
    console.error("Error fetching users:", error)
    res.status(500).json({ msg: "Failed to fetch users" })
  }
}

// Get current user's own profile (optionalAuth: no token → { user: null }; with valid token → user object)
export const getProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(200).json({ user: null })
    }
    const user = await User.findById(req.user.id).select("-password").populate("website", "name domain")
    if (!user) {
      return res.status(200).json({ user: null })
    }
    res.status(200).json(user)
  } catch (error) {
    console.error("Error fetching profile:", error)
    res.status(500).json({ msg: "Failed to fetch profile" })
  }
}

// Update current user's own profile (name, phone, address) - for storefront checkout pre-fill
export const updateMyProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ msg: "Not authorized" })
    }
    const user = await User.findById(req.user.id)
    if (!user) {
      return res.status(404).json({ msg: "User not found" })
    }
    const { name, phone, address } = req.body
    if (name !== undefined && name !== null && String(name).trim()) user.name = String(name).trim()
    if (phone !== undefined) user.phone = phone?.trim() || null
    if (address !== undefined && typeof address === "object") {
      user.address = {
        street: address.street?.trim() || null,
        city: address.city?.trim() || null,
        state: address.state?.trim() || null,
        zipCode: address.zipCode?.trim() || null,
        country: address.country?.trim() || null,
      }
    }
    await user.save()
    const updated = await User.findById(user._id).select("-password")
    res.json(updated)
  } catch (error) {
    console.error("Error updating profile:", error)
    res.status(500).json({ msg: "Failed to update profile" })
  }
}

// Get single user by ID
export const getUserById = async (req, res) => {
  try {
    // Multi-tenant: Super admins can access any user, others can only access users from their website
    const isSuperAdmin = req.user && req.user.role === "admin"

    let query = { _id: req.params.id }
    if (!isSuperAdmin && req.websiteId) {
      query.$or = [{ website: req.websiteId }, { website: null }]
    }

    const user = await User.findOne(query).select("-password")
    if (!user) {
      return res.status(404).json({ msg: "User not found" })
    }
    res.json(user)
  } catch (error) {
    console.error("Error fetching user:", error)
    res.status(500).json({ msg: "Failed to fetch user" })
  }
}

// Create new user
export const createUser = async (req, res) => {
  try {
    // Multi-tenant: For non-super-admins, website context is required for customers
    const isSuperAdmin = req.user && req.user.role === "admin"
    const userRole = req.body.role || "customer"

    // Customers must belong to a website (unless super admin)
    if (userRole === "customer" && !isSuperAdmin && !req.websiteId) {
      return res.status(400).json({ msg: "Website context is required for customer users" })
    }

    const { name, email, password, phone, address, role, picture, isActive, emailVerified } = req.body

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ msg: "Name is required" })
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ msg: "Email is required" })
    }

    // Check if user with email already exists (non-deleted)
    // For multi-tenant: check within the same website (or globally for super admins)
    let emailCheckQuery = {
      email: email.toLowerCase().trim(),
      deleted: false,
    }

    // If not super admin and website context exists, check email uniqueness within website
    if (!isSuperAdmin && req.websiteId) {
      emailCheckQuery.$or = [
        { website: req.websiteId },
        { website: null }, // Also check super admins
      ]
    }

    const existingUser = await User.findOne(emailCheckQuery)

    if (existingUser) {
      return res.status(400).json({ msg: "User with this email already exists" })
    }

    // If password is provided, hash it
    let hashedPassword = null
    if (password && password.trim()) {
      hashedPassword = await bcrypt.hash(password, 10)
    }

    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phone: phone?.trim() || null,
      address: address || {},
      role: role || "customer",
      picture: picture || null,
      website: userRole === "customer" && req.websiteId ? req.websiteId : null, // Set website for customers
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      emailVerified: emailVerified !== undefined ? Boolean(emailVerified) : false,
      deleted: false,
    })

    const savedUser = await newUser.save()
    const userResponse = savedUser.toObject()
    delete userResponse.password

    res.status(201).json(userResponse)
  } catch (error) {
    console.error("Error creating user:", error)
    if (error.code === 11000) {
      return res.status(400).json({ msg: "User with this email already exists" })
    }
    res.status(500).json({ msg: `Failed to create user: ${error.message || error}` })
  }
}

// Update user
export const updateUser = async (req, res) => {
  try {
    // Multi-tenant: Super admins can update any user, others can only update users from their website
    const isSuperAdmin = req.user && req.user.role === "admin"

    let query = { _id: req.params.id }
    if (!isSuperAdmin && req.websiteId) {
      query.$or = [{ website: req.websiteId }, { website: null }]
    }

    const user = await User.findOne(query)
    if (!user) {
      return res.status(404).json({ msg: "User not found" })
    }

    const { name, email, password, phone, address, role, picture, isActive, emailVerified, deleted } = req.body

    // Check for duplicate email (excluding current user, only non-deleted)
    // For multi-tenant: check within the same website (or globally for super admins)
    if (email && email.toLowerCase().trim() !== user.email) {
      let emailCheckQuery = {
        _id: { $ne: req.params.id },
        email: email.toLowerCase().trim(),
        deleted: false,
      }

      // If not super admin and website context exists, check email uniqueness within website
      if (!isSuperAdmin && req.websiteId) {
        emailCheckQuery.$or = [{ website: req.websiteId }, { website: null }]
      }

      const existingUser = await User.findOne(emailCheckQuery)
      if (existingUser) {
        return res.status(400).json({ msg: "User with this email already exists" })
      }
      user.email = email.toLowerCase().trim()
    }

    // Update fields
    if (name !== undefined) user.name = name.trim()
    if (phone !== undefined) user.phone = phone?.trim() || null
    if (address !== undefined) user.address = address || {}
    if (role !== undefined) {
      user.role = role
      // If changing to customer and website context exists, set website
      if (role === "customer" && req.websiteId && !user.website) {
        user.website = req.websiteId
      }
      // If changing from customer to admin/editor, remove website assignment
      if ((role === "admin" || role === "editor") && user.website) {
        user.website = null
      }
    }
    if (picture !== undefined) user.picture = picture || null
    if (isActive !== undefined) user.isActive = Boolean(isActive)
    if (emailVerified !== undefined) user.emailVerified = Boolean(emailVerified)
    if (deleted !== undefined) user.deleted = Boolean(deleted)

    // Update password if provided
    if (password && password.trim()) {
      user.password = await bcrypt.hash(password.trim(), 10)
    }

    const updatedUser = await user.save()
    const userResponse = updatedUser.toObject()
    delete userResponse.password

    res.json(userResponse)
  } catch (error) {
    console.error("Error updating user:", error)
    if (error.code === 11000) {
      return res.status(400).json({ msg: "User with this email already exists" })
    }
    res.status(500).json({ msg: "Failed to update user" })
  }
}

// Delete user (soft delete)
export const deleteUser = async (req, res) => {
  try {
    // Multi-tenant: Super admins can delete any user, others can only delete users from their website
    const isSuperAdmin = req.user && req.user.role === "admin"

    let query = { _id: req.params.id }
    if (!isSuperAdmin && req.websiteId) {
      query.$or = [{ website: req.websiteId }, { website: null }]
    }

    const user = await User.findOne(query)
    if (!user) {
      return res.status(404).json({ msg: "User not found" })
    }

    user.isActive = false
    user.deleted = true
    await user.save()

    res.json({ msg: "User deleted successfully" })
  } catch (error) {
    console.error("Error deleting user:", error)
    res.status(500).json({ msg: "Failed to delete user" })
  }
}

// Hard delete user
export const hardDeleteUser = async (req, res) => {
  try {
    // Multi-tenant: Super admins can delete any user, others can only delete users from their website
    const isSuperAdmin = req.user && req.user.role === "admin"

    let query = { _id: req.params.id }
    if (!isSuperAdmin && req.websiteId) {
      query.$or = [{ website: req.websiteId }, { website: null }]
    }

    const user = await User.findOneAndDelete(query)
    if (!user) {
      return res.status(404).json({ msg: "User not found" })
    }

    res.json({ msg: "User permanently deleted" })
  } catch (error) {
    console.error("Error deleting user:", error)
    res.status(500).json({ msg: "Failed to delete user" })
  }
}
