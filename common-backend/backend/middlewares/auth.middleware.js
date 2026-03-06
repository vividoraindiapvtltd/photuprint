import jwt from "jsonwebtoken"
import User from "../models/user.model.js"

export const protect = async (req, res, next) => {
  let token = req.headers.authorization?.split(" ")[1]
  if (!token) return res.status(401).json({ msg: "Not authorized" })

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = await User.findById(decoded.id).select("-password")
    if (!req.user) {
      return res.status(401).json({ msg: "User not found" })
    }
    next()
  } catch (err) {
    res.status(401).json({ msg: "Invalid token" })
  }
}

// Optional authentication - doesn't fail if no token, but sets req.user if token is valid
export const optionalAuth = async (req, res, next) => {
  let token = req.headers.authorization?.split(" ")[1]
  if (!token) {
    req.user = null
    return next()
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = await User.findById(decoded.id).select("-password")
    next()
  } catch (err) {
    // If token is invalid, just continue without user (for public submissions)
    req.user = null
    next()
  }
}

export const adminOnly = (req, res, next) => {
  // Allow admin, super_admin, and editor roles
  const allowedRoles = ["admin", "super_admin", "editor"]
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ msg: "Access denied. Admin only." })
  }
  next()
}