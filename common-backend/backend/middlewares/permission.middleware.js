/**
 * Permission Middleware
 * 
 * Provides role-based access control (RBAC) for API routes.
 * - Super Admin bypasses all permission checks
 * - Staff users must have specific permissions
 * - Supports single permission, any permission, or all permissions checks
 */

/**
 * Check if user has a specific permission
 * @param {string} permissionKey - The permission key to check
 * @returns {Function} Express middleware
 */
export const requirePermission = (permissionKey) => {
  return (req, res, next) => {
    try {
      // Must be authenticated
      if (!req.user) {
        return res.status(401).json({
          msg: "Authentication required",
          code: "AUTH_REQUIRED"
        })
      }
      
      // Check if account is active
      if (!req.user.isActive) {
        return res.status(403).json({
          msg: "Your account has been deactivated",
          code: "ACCOUNT_INACTIVE"
        })
      }
      
      // Check if account is deleted
      if (req.user.deleted) {
        return res.status(403).json({
          msg: "Your account has been deleted",
          code: "ACCOUNT_DELETED"
        })
      }
      
      // Super admin bypasses all permission checks
      if (req.user.role === "super_admin") {
        return next()
      }
      
      // Check permission using the model method
      if (req.user.hasPermission && req.user.hasPermission(permissionKey)) {
        return next()
      }
      
      // Fallback check if method not available (in case user wasn't populated properly)
      if (req.user.permissions && req.user.permissions.includes(permissionKey)) {
        return next()
      }
      
      // Permission denied
      return res.status(403).json({
        msg: "You don't have permission to access this resource",
        code: "PERMISSION_DENIED",
        required: permissionKey
      })
    } catch (error) {
      console.error("Permission middleware error:", error)
      return res.status(500).json({
        msg: "Error checking permissions",
        code: "PERMISSION_ERROR"
      })
    }
  }
}

/**
 * Check if user has any of the specified permissions
 * @param {string[]} permissionKeys - Array of permission keys (user needs at least one)
 * @returns {Function} Express middleware
 */
export const requireAnyPermission = (permissionKeys) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          msg: "Authentication required",
          code: "AUTH_REQUIRED"
        })
      }
      
      if (!req.user.isActive || req.user.deleted) {
        return res.status(403).json({
          msg: "Your account is not active",
          code: "ACCOUNT_INACTIVE"
        })
      }
      
      // Super admin bypasses all
      if (req.user.role === "super_admin") {
        return next()
      }
      
      // Check if user has any of the permissions
      const hasPermission = permissionKeys.some(key => {
        if (req.user.hasPermission) return req.user.hasPermission(key)
        return req.user.permissions && req.user.permissions.includes(key)
      })
      
      if (hasPermission) {
        return next()
      }
      
      return res.status(403).json({
        msg: "You don't have permission to access this resource",
        code: "PERMISSION_DENIED",
        required: permissionKeys,
        requireType: "any"
      })
    } catch (error) {
      console.error("Permission middleware error:", error)
      return res.status(500).json({
        msg: "Error checking permissions",
        code: "PERMISSION_ERROR"
      })
    }
  }
}

/**
 * Check if user has all of the specified permissions
 * @param {string[]} permissionKeys - Array of permission keys (user needs all)
 * @returns {Function} Express middleware
 */
export const requireAllPermissions = (permissionKeys) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          msg: "Authentication required",
          code: "AUTH_REQUIRED"
        })
      }
      
      if (!req.user.isActive || req.user.deleted) {
        return res.status(403).json({
          msg: "Your account is not active",
          code: "ACCOUNT_INACTIVE"
        })
      }
      
      // Super admin bypasses all
      if (req.user.role === "super_admin") {
        return next()
      }
      
      // Check if user has all permissions
      const hasAllPermissions = permissionKeys.every(key => {
        if (req.user.hasPermission) return req.user.hasPermission(key)
        return req.user.permissions && req.user.permissions.includes(key)
      })
      
      if (hasAllPermissions) {
        return next()
      }
      
      return res.status(403).json({
        msg: "You don't have all required permissions",
        code: "PERMISSION_DENIED",
        required: permissionKeys,
        requireType: "all"
      })
    } catch (error) {
      console.error("Permission middleware error:", error)
      return res.status(500).json({
        msg: "Error checking permissions",
        code: "PERMISSION_ERROR"
      })
    }
  }
}

/**
 * Require super admin role
 * @returns {Function} Express middleware
 */
export const requireSuperAdmin = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        msg: "Authentication required",
        code: "AUTH_REQUIRED"
      })
    }
    
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        msg: "Super Admin access required",
        code: "SUPER_ADMIN_REQUIRED"
      })
    }
    
    return next()
  } catch (error) {
    console.error("Super admin check error:", error)
    return res.status(500).json({
      msg: "Error checking admin status",
      code: "AUTH_ERROR"
    })
  }
}

/**
 * Require admin or super admin role
 * @returns {Function} Express middleware
 */
export const requireAdminRole = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        msg: "Authentication required",
        code: "AUTH_REQUIRED"
      })
    }
    
    if (!["admin", "super_admin", "editor"].includes(req.user.role)) {
      return res.status(403).json({
        msg: "Admin access required",
        code: "ADMIN_REQUIRED"
      })
    }
    
    return next()
  } catch (error) {
    console.error("Admin role check error:", error)
    return res.status(500).json({
      msg: "Error checking admin status",
      code: "AUTH_ERROR"
    })
  }
}

/**
 * Dynamic permission check based on route params
 * Useful for CRUD operations where permission depends on action
 * @param {string} module - The module name (e.g., "products", "orders")
 * @returns {Function} Express middleware
 */
export const requireModulePermission = (module) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          msg: "Authentication required",
          code: "AUTH_REQUIRED"
        })
      }
      
      if (!req.user.isActive || req.user.deleted) {
        return res.status(403).json({
          msg: "Your account is not active",
          code: "ACCOUNT_INACTIVE"
        })
      }
      
      // Super admin bypasses all
      if (req.user.role === "super_admin") {
        return next()
      }
      
      // Determine action based on HTTP method
      let action = "view"
      switch (req.method) {
        case "POST":
          action = "create"
          break
        case "PUT":
        case "PATCH":
          action = "edit"
          break
        case "DELETE":
          action = "delete"
          break
        default:
          action = "view"
      }
      
      const permissionKey = `${module}_${action}`
      
      // Check permission
      const hasPermission = req.user.hasPermission 
        ? req.user.hasPermission(permissionKey) 
        : (req.user.permissions && req.user.permissions.includes(permissionKey))
      
      // Also check for "manage" permission which grants all actions
      const hasManagePermission = req.user.hasPermission 
        ? req.user.hasPermission(`${module}_manage`) 
        : (req.user.permissions && req.user.permissions.includes(`${module}_manage`))
      
      if (hasPermission || hasManagePermission) {
        return next()
      }
      
      return res.status(403).json({
        msg: `You don't have permission to ${action} ${module}`,
        code: "PERMISSION_DENIED",
        required: permissionKey
      })
    } catch (error) {
      console.error("Module permission check error:", error)
      return res.status(500).json({
        msg: "Error checking permissions",
        code: "PERMISSION_ERROR"
      })
    }
  }
}

/**
 * Attach user permissions to request for frontend use
 * Call this after authentication to include permissions in response
 */
export const attachPermissions = (req, res, next) => {
  if (req.user) {
    // Super admin gets all permissions marker
    if (req.user.role === "super_admin") {
      req.userPermissions = ["*"] // Wildcard for all permissions
      req.isSuperAdmin = true
    } else {
      req.userPermissions = req.user.permissions || []
      req.isSuperAdmin = false
    }
  }
  next()
}

export default {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireSuperAdmin,
  requireAdminRole,
  requireModulePermission,
  attachPermissions
}
