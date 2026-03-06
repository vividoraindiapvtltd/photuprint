import User from "../models/user.model.js"
import Permission from "../models/permission.model.js"
import bcrypt from "bcryptjs"

/**
 * User Access Management Controller
 * 
 * Provides CRUD operations for managing staff users and their permissions.
 * - Super Admin can create, edit, delete staff users
 * - Super Admin can assign/revoke permissions
 * - Super Admin can enable/disable accounts
 * - Multi-tenant support
 */

// ============================================================================
// PERMISSION MANAGEMENT
// ============================================================================

/**
 * Get all permissions (grouped by module)
 */
export const getAllPermissions = async (req, res) => {
  try {
    const permissions = await Permission.find({ isActive: true })
      .sort({ module: 1, sortOrder: 1 })
      .lean()
    
    // Group by module
    const grouped = {}
    permissions.forEach(permission => {
      if (!grouped[permission.module]) {
        grouped[permission.module] = {
          module: permission.module,
          label: permission.module.charAt(0).toUpperCase() + permission.module.slice(1).replace(/_/g, ' '),
          permissions: []
        }
      }
      grouped[permission.module].permissions.push(permission)
    })
    
    res.json({
      permissions,
      grouped: Object.values(grouped)
    })
  } catch (error) {
    console.error("Error fetching permissions:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Seed default permissions
 */
export const seedPermissions = async (req, res) => {
  try {
    const count = await Permission.seedDefaultPermissions()
    res.json({
      msg: `Successfully seeded ${count} permissions`,
      count
    })
  } catch (error) {
    console.error("Error seeding permissions:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Create a custom permission
 */
export const createPermission = async (req, res) => {
  try {
    const { key, label, description, module, action = "view", sortOrder = 0 } = req.body
    
    if (!key || !label || !module) {
      return res.status(400).json({ msg: "Key, label, and module are required" })
    }
    
    // Check if permission already exists
    const existing = await Permission.findOne({ key: key.toLowerCase() })
    if (existing) {
      return res.status(400).json({ msg: "Permission with this key already exists" })
    }
    
    const permission = new Permission({
      key: key.toLowerCase().replace(/\s+/g, '_'),
      label: label.trim(),
      description: description?.trim(),
      module: module.toLowerCase().replace(/\s+/g, '_'),
      action,
      sortOrder
    })
    
    await permission.save()
    
    res.status(201).json({
      msg: "Permission created successfully",
      permission
    })
  } catch (error) {
    console.error("Error creating permission:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Delete a permission (only non-system permissions)
 */
export const deletePermission = async (req, res) => {
  try {
    const { id } = req.params
    
    const permission = await Permission.findById(id)
    
    if (!permission) {
      return res.status(404).json({ msg: "Permission not found" })
    }
    
    if (permission.isSystem) {
      return res.status(400).json({ msg: "Cannot delete system permissions" })
    }
    
    // Remove this permission from all users
    await User.updateMany(
      { permissions: permission.key },
      { $pull: { permissions: permission.key } }
    )
    
    await permission.deleteOne()
    
    res.json({ msg: "Permission deleted successfully" })
  } catch (error) {
    console.error("Error deleting permission:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

// ============================================================================
// STAFF USER MANAGEMENT
// ============================================================================

/**
 * Get all staff users (admin, editor roles)
 */
export const getStaffUsers = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    
    const {
      search,
      role,
      status,
      page = 1,
      limit = 20,
      includeDeleted = "false"
    } = req.query
    
    // Build query - only get staff users (not customers)
    const query = {
      role: { $in: ["admin", "editor", "super_admin"] }
    }
    
    // Filter by role if specified
    if (role && role !== "all") {
      query.role = role
    }
    
    // Filter by status
    if (status === "active") {
      query.isActive = true
      query.deleted = false
    } else if (status === "inactive") {
      query.isActive = false
    } else if (status === "deleted") {
      query.deleted = true
    } else if (includeDeleted !== "true") {
      query.deleted = false
    }
    
    // Search
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } }
      ]
    }
    
    // For non-super admins, filter by website
    if (req.user.role !== "super_admin" && websiteId) {
      query.$or = [
        { website: websiteId },
        { accessibleWebsites: websiteId }
      ]
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit)
    
    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password")
        .populate("website", "name domain")
        .populate("accessibleWebsites", "name domain")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query)
    ])
    
    res.json({
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error("Error fetching staff users:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Get a single staff user by ID
 */
export const getStaffUserById = async (req, res) => {
  try {
    const { id } = req.params
    
    const user = await User.findById(id)
      .select("-password")
      .populate("website", "name domain")
      .populate("accessibleWebsites", "name domain")
      .populate("createdBy", "name email")
    
    if (!user) {
      return res.status(404).json({ msg: "User not found" })
    }
    
    // Non-super admins can only see staff from their website
    if (req.user.role !== "super_admin") {
      const websiteId = req.websiteId || req.tenant?._id
      const hasAccess = user.website?.toString() === websiteId?.toString() ||
        user.accessibleWebsites?.some(w => w._id?.toString() === websiteId?.toString())
      
      if (!hasAccess) {
        return res.status(403).json({ msg: "Access denied" })
      }
    }
    
    res.json(user)
  } catch (error) {
    console.error("Error fetching staff user:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Create a new staff user
 */
export const createStaffUser = async (req, res) => {
  try {
    const {
      name,
      email,
      username,
      password,
      role = "admin",
      permissions = [],
      website,
      accessibleWebsites = [],
      phone,
      isActive = true
    } = req.body
    
    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ msg: "Name, email, and password are required" })
    }
    
    if (password.length < 8) {
      return res.status(400).json({ msg: "Password must be at least 8 characters" })
    }
    
    // Only super admin can create super admins
    if (role === "super_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ msg: "Only Super Admin can create Super Admin accounts" })
    }
    
    // Check for existing email
    const existingEmail = await User.findOne({ email: email.toLowerCase() })
    if (existingEmail) {
      return res.status(400).json({ msg: "A user with this email already exists" })
    }
    
    // Check for existing username if provided
    if (username) {
      const existingUsername = await User.findOne({ username: username.toLowerCase() })
      if (existingUsername) {
        return res.status(400).json({ msg: "This username is already taken" })
      }
    }
    
    // Validate permissions exist
    if (permissions.length > 0) {
      const validPermissions = await Permission.find({ key: { $in: permissions } })
      if (validPermissions.length !== permissions.length) {
        return res.status(400).json({ msg: "Some permissions are invalid" })
      }
    }
    
    // Determine website assignment
    let assignedWebsite = website
    if (!website && req.user.role !== "super_admin") {
      assignedWebsite = req.websiteId || req.tenant?._id
    }
    
    // Create user
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      username: username?.toLowerCase().trim() || null,
      password, // Will be hashed by pre-save hook
      role,
      permissions: role === "super_admin" ? [] : permissions, // Super admin doesn't need permissions
      website: assignedWebsite,
      accessibleWebsites,
      phone: phone?.trim(),
      isActive,
      emailVerified: true, // Staff users are pre-verified
      createdBy: req.user._id
    })
    
    await user.save()
    
    // Return user without password
    const createdUser = await User.findById(user._id)
      .select("-password")
      .populate("website", "name domain")
      .populate("accessibleWebsites", "name domain")
    
    res.status(201).json({
      msg: "Staff user created successfully",
      user: createdUser
    })
  } catch (error) {
    console.error("Error creating staff user:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Update a staff user
 */
export const updateStaffUser = async (req, res) => {
  try {
    const { id } = req.params
    const {
      name,
      email,
      username,
      password,
      role,
      permissions,
      website,
      accessibleWebsites,
      phone,
      isActive,
      deleted
    } = req.body
    
    const user = await User.findById(id)
    
    if (!user) {
      return res.status(404).json({ msg: "User not found" })
    }
    
    // Prevent modifying super admins unless you're a super admin
    if (user.role === "super_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ msg: "Cannot modify Super Admin accounts" })
    }
    
    // Prevent changing role to/from super admin unless you're a super admin
    if (role && role !== user.role) {
      if ((role === "super_admin" || user.role === "super_admin") && req.user.role !== "super_admin") {
        return res.status(403).json({ msg: "Cannot change Super Admin role" })
      }
    }
    
    // Prevent self-deactivation
    if (id === req.user._id.toString() && isActive === false) {
      return res.status(400).json({ msg: "Cannot deactivate your own account" })
    }
    
    // Check email uniqueness if changing
    if (email && email.toLowerCase() !== user.email) {
      const existingEmail = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: id }
      })
      if (existingEmail) {
        return res.status(400).json({ msg: "This email is already in use" })
      }
    }
    
    // Check username uniqueness if changing
    if (username && username.toLowerCase() !== user.username) {
      const existingUsername = await User.findOne({
        username: username.toLowerCase(),
        _id: { $ne: id }
      })
      if (existingUsername) {
        return res.status(400).json({ msg: "This username is already taken" })
      }
    }
    
    // Update fields
    if (name !== undefined) user.name = name.trim()
    if (email !== undefined) user.email = email.toLowerCase().trim()
    if (username !== undefined) user.username = username?.toLowerCase().trim() || null
    if (role !== undefined) user.role = role
    if (phone !== undefined) user.phone = phone?.trim()
    if (isActive !== undefined) user.isActive = isActive
    if (deleted !== undefined) user.deleted = deleted
    if (website !== undefined) user.website = website
    if (accessibleWebsites !== undefined) user.accessibleWebsites = accessibleWebsites
    
    // Handle permissions (super admins don't need permissions)
    if (permissions !== undefined && user.role !== "super_admin") {
      user.permissions = permissions
    }
    
    // Handle password change
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ msg: "Password must be at least 8 characters" })
      }
      user.password = password // Will be hashed by pre-save hook
    }
    
    await user.save()
    
    // Return updated user without password
    const updatedUser = await User.findById(user._id)
      .select("-password")
      .populate("website", "name domain")
      .populate("accessibleWebsites", "name domain")
    
    res.json({
      msg: "Staff user updated successfully",
      user: updatedUser
    })
  } catch (error) {
    console.error("Error updating staff user:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Update user permissions
 */
export const updateUserPermissions = async (req, res) => {
  try {
    const { id } = req.params
    const { permissions } = req.body
    
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ msg: "Permissions must be an array" })
    }
    
    const user = await User.findById(id)
    
    if (!user) {
      return res.status(404).json({ msg: "User not found" })
    }
    
    // Cannot modify super admin permissions
    if (user.role === "super_admin") {
      return res.status(400).json({ msg: "Super Admin has all permissions by default" })
    }
    
    // Validate all permissions exist
    if (permissions.length > 0) {
      const validPermissions = await Permission.find({ key: { $in: permissions } })
      if (validPermissions.length !== permissions.length) {
        return res.status(400).json({ msg: "Some permissions are invalid" })
      }
    }
    
    user.permissions = permissions
    await user.save()
    
    res.json({
      msg: "Permissions updated successfully",
      permissions: user.permissions
    })
  } catch (error) {
    console.error("Error updating permissions:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Toggle user active status
 */
export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params
    
    const user = await User.findById(id)
    
    if (!user) {
      return res.status(404).json({ msg: "User not found" })
    }
    
    // Prevent self-deactivation
    if (id === req.user._id.toString()) {
      return res.status(400).json({ msg: "Cannot change your own status" })
    }
    
    // Prevent modifying super admins unless you're a super admin
    if (user.role === "super_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ msg: "Cannot modify Super Admin accounts" })
    }
    
    user.isActive = !user.isActive
    await user.save()
    
    res.json({
      msg: `User ${user.isActive ? "activated" : "deactivated"} successfully`,
      isActive: user.isActive
    })
  } catch (error) {
    console.error("Error toggling user status:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Soft delete a staff user
 */
export const deleteStaffUser = async (req, res) => {
  try {
    const { id } = req.params
    
    const user = await User.findById(id)
    
    if (!user) {
      return res.status(404).json({ msg: "User not found" })
    }
    
    // Prevent self-deletion
    if (id === req.user._id.toString()) {
      return res.status(400).json({ msg: "Cannot delete your own account" })
    }
    
    // Prevent deleting super admins unless you're a super admin
    if (user.role === "super_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ msg: "Cannot delete Super Admin accounts" })
    }
    
    user.deleted = true
    user.isActive = false
    await user.save()
    
    res.json({ msg: "User deleted successfully" })
  } catch (error) {
    console.error("Error deleting staff user:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Restore a deleted staff user
 */
export const restoreStaffUser = async (req, res) => {
  try {
    const { id } = req.params
    
    const user = await User.findById(id)
    
    if (!user) {
      return res.status(404).json({ msg: "User not found" })
    }
    
    if (!user.deleted) {
      return res.status(400).json({ msg: "User is not deleted" })
    }
    
    user.deleted = false
    user.isActive = true
    await user.save()
    
    res.json({
      msg: "User restored successfully",
      user: await User.findById(id).select("-password")
    })
  } catch (error) {
    console.error("Error restoring staff user:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Hard delete a staff user (permanent)
 */
export const hardDeleteStaffUser = async (req, res) => {
  try {
    const { id } = req.params
    
    const user = await User.findById(id)
    
    if (!user) {
      return res.status(404).json({ msg: "User not found" })
    }
    
    // Prevent self-deletion
    if (id === req.user._id.toString()) {
      return res.status(400).json({ msg: "Cannot delete your own account" })
    }
    
    // Prevent deleting super admins
    if (user.role === "super_admin") {
      return res.status(403).json({ msg: "Cannot permanently delete Super Admin accounts" })
    }
    
    await user.deleteOne()
    
    res.json({ msg: "User permanently deleted" })
  } catch (error) {
    console.error("Error hard deleting staff user:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Reset user password
 */
export const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params
    const { newPassword } = req.body
    
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ msg: "Password must be at least 8 characters" })
    }
    
    const user = await User.findById(id)
    
    if (!user) {
      return res.status(404).json({ msg: "User not found" })
    }
    
    // Only super admin can reset super admin passwords
    if (user.role === "super_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ msg: "Cannot reset Super Admin password" })
    }
    
    user.password = newPassword // Will be hashed by pre-save hook
    user.failedLoginAttempts = 0
    user.lockedUntil = null
    await user.save()
    
    res.json({ msg: "Password reset successfully" })
  } catch (error) {
    console.error("Error resetting password:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Unlock a locked user account
 */
export const unlockUserAccount = async (req, res) => {
  try {
    const { id } = req.params
    
    const user = await User.findById(id)
    
    if (!user) {
      return res.status(404).json({ msg: "User not found" })
    }
    
    user.failedLoginAttempts = 0
    user.lockedUntil = null
    await user.save()
    
    res.json({ msg: "Account unlocked successfully" })
  } catch (error) {
    console.error("Error unlocking account:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get user access statistics
 */
export const getUserAccessStats = async (req, res) => {
  try {
    const websiteId = req.websiteId || req.tenant?._id
    
    const baseQuery = {
      role: { $in: ["admin", "editor", "super_admin"] }
    }
    
    // For non-super admins, filter by website
    if (req.user.role !== "super_admin" && websiteId) {
      baseQuery.$or = [
        { website: websiteId },
        { accessibleWebsites: websiteId }
      ]
    }
    
    const [
      total,
      active,
      inactive,
      deleted,
      byRole,
      lockedAccounts,
      recentLogins
    ] = await Promise.all([
      User.countDocuments({ ...baseQuery, deleted: false }),
      User.countDocuments({ ...baseQuery, isActive: true, deleted: false }),
      User.countDocuments({ ...baseQuery, isActive: false, deleted: false }),
      User.countDocuments({ ...baseQuery, deleted: true }),
      User.aggregate([
        { $match: { ...baseQuery, deleted: false } },
        { $group: { _id: "$role", count: { $sum: 1 } } }
      ]),
      User.countDocuments({
        ...baseQuery,
        lockedUntil: { $gt: new Date() }
      }),
      User.countDocuments({
        ...baseQuery,
        lastLoginAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
    ])
    
    // Get permission count
    const permissionCount = await Permission.countDocuments({ isActive: true })
    
    res.json({
      total,
      active,
      inactive,
      deleted,
      byRole: byRole.reduce((acc, item) => {
        acc[item._id] = item.count
        return acc
      }, {}),
      lockedAccounts,
      recentLogins,
      totalPermissions: permissionCount
    })
  } catch (error) {
    console.error("Error fetching user access stats:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Get current user's permissions (for frontend)
 */
export const getCurrentUserPermissions = async (req, res) => {
  try {
    const user = req.user
    
    // Super admin has all permissions
    if (user.role === "super_admin") {
      const allPermissions = await Permission.find({ isActive: true }).select("key")
      return res.json({
        role: user.role,
        isSuperAdmin: true,
        permissions: allPermissions.map(p => p.key),
        hasAllPermissions: true
      })
    }
    
    res.json({
      role: user.role,
      isSuperAdmin: false,
      permissions: user.permissions || [],
      hasAllPermissions: false
    })
  } catch (error) {
    console.error("Error fetching current user permissions:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

// ============================================================================
// CUSTOMER PROMOTION (Upgrade to Staff)
// ============================================================================

/**
 * Get customers who can be promoted to staff
 * Supports search by name or email
 */
export const getCustomers = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 10 } = req.query
    
    // Build query for customers only
    const query = {
      role: "customer",
      deleted: { $ne: true }
    }
    
    // Add search filter if provided
    if (search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i")
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ]
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit)
    
    const [customers, total] = await Promise.all([
      User.find(query)
        .select("name email phone picture createdAt isActive")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query)
    ])
    
    res.json({
      customers,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    })
  } catch (error) {
    console.error("Error fetching customers:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Promote a customer to staff role
 */
export const promoteToStaff = async (req, res) => {
  try {
    const { id } = req.params
    const { role = "editor", permissions = [] } = req.body
    
    // Validate role
    const allowedRoles = ["admin", "editor"]
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ 
        msg: "Invalid role. Allowed roles: admin, editor" 
      })
    }
    
    // Only super admin can promote to admin
    if (role === "admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ 
        msg: "Only Super Admin can promote users to Admin role" 
      })
    }
    
    // Find the customer
    const customer = await User.findById(id)
    
    if (!customer) {
      return res.status(404).json({ msg: "User not found" })
    }
    
    if (customer.role !== "customer") {
      return res.status(400).json({ 
        msg: `User is already a ${customer.role}, not a customer` 
      })
    }
    
    // Validate permissions if provided
    if (permissions.length > 0) {
      const validPermissions = await Permission.find({ key: { $in: permissions } })
      if (validPermissions.length !== permissions.length) {
        return res.status(400).json({ msg: "Some permissions are invalid" })
      }
    }
    
    // Update the user
    customer.role = role
    customer.permissions = permissions
    customer.updatedAt = new Date()
    
    await customer.save()
    
    res.json({
      msg: `User successfully promoted to ${role}`,
      user: {
        _id: customer._id,
        name: customer.name,
        email: customer.email,
        role: customer.role,
        permissions: customer.permissions,
        isActive: customer.isActive
      }
    })
  } catch (error) {
    console.error("Error promoting customer to staff:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

// ============================================================================
// WEBSITE ACCESS
// ============================================================================

/**
 * Get websites accessible to the current user
 * Super admins and admins can access all websites
 * Staff users can only access websites in their accessibleWebsites array
 */
export const getMyAccessibleWebsites = async (req, res) => {
  try {
    const user = req.user
    
    // Import Website model dynamically to avoid circular dependency
    const Website = (await import("../models/website.model.js")).default
    
    // Super admin and admin roles can access all active websites
    if (user.role === 'super_admin' || user.role === 'admin') {
      const websites = await Website.find({ 
        isActive: true, 
        deleted: false 
      }).select('name domain logo isActive').lean()
      
      return res.json({
        websites,
        hasFullAccess: true
      })
    }
    
    // For other roles, filter by accessibleWebsites
    const accessibleWebsiteIds = user.accessibleWebsites || []
    
    if (accessibleWebsiteIds.length === 0) {
      return res.json({
        websites: [],
        hasFullAccess: false,
        message: "No websites assigned. Please contact administrator."
      })
    }
    
    const websites = await Website.find({
      _id: { $in: accessibleWebsiteIds },
      isActive: true,
      deleted: false
    }).select('name domain logo isActive').lean()
    
    res.json({
      websites,
      hasFullAccess: false
    })
  } catch (error) {
    console.error("Error fetching accessible websites:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}

/**
 * Update user's accessible websites
 */
export const updateUserWebsiteAccess = async (req, res) => {
  try {
    const { id } = req.params
    const { accessibleWebsites = [] } = req.body
    
    const user = await User.findById(id)
    
    if (!user) {
      return res.status(404).json({ msg: "User not found" })
    }
    
    // Don't allow modifying super_admin website access
    if (user.role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ msg: "Cannot modify Super Admin's website access" })
    }
    
    // Validate website IDs exist
    if (accessibleWebsites.length > 0) {
      const Website = (await import("../models/website.model.js")).default
      const validWebsites = await Website.find({ 
        _id: { $in: accessibleWebsites },
        deleted: false 
      })
      
      if (validWebsites.length !== accessibleWebsites.length) {
        return res.status(400).json({ msg: "Some website IDs are invalid" })
      }
    }
    
    user.accessibleWebsites = accessibleWebsites
    user.updatedAt = new Date()
    await user.save()
    
    res.json({
      msg: "Website access updated successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        accessibleWebsites: user.accessibleWebsites
      }
    })
  } catch (error) {
    console.error("Error updating website access:", error)
    res.status(500).json({ msg: "Server error", error: error.message })
  }
}
