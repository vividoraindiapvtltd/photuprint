import mongoose from "mongoose"
import bcrypt from "bcryptjs"

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: function () {
        return !this.googleId
      },
    }, // Password required only if not Google user
    googleId: { type: String, unique: true, sparse: true }, // Google OAuth ID
    picture: { type: String, default: null }, // Google profile picture or uploaded avatar
    phone: { type: String, default: null },
    address: {
      street: { type: String, default: null },
      city: { type: String, default: null },
      state: { type: String, default: null },
      zipCode: { type: String, default: null },
      country: { type: String, default: null }
    },
    role: { 
      type: String, 
      enum: ["admin", "customer", "editor", "super_admin"], 
      default: "customer" 
    },
    isActive: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    verificationTokenHash: { type: String, default: null, select: false },
    verificationTokenExpiresAt: { type: Date, default: null, select: false },
    deleted: { type: Boolean, default: false },
    // Multi-tenant: Website/Tenant reference (for customers, optional for admins)
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Website',
      default: null,
    },
    // For super admins and website admins: list of websites they can access
    accessibleWebsites: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Website'
    }],
    
    // RBAC: Array of permission keys assigned to this user
    permissions: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
    
    // Username for login (optional, uses email by default)
    username: {
      type: String,
      sparse: true,
      trim: true,
      lowercase: true,
      maxlength: [50, "Username cannot exceed 50 characters"],
      match: [/^[a-z0-9_]+$/, "Username can only contain lowercase letters, numbers, and underscores"],
    },
    
    // Last login timestamp
    lastLoginAt: {
      type: Date,
      default: null,
    },
    
    // Failed login attempts (for security)
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    
    // Account locked until (for security)
    lockedUntil: {
      type: Date,
      default: null,
    },
    
    // Created by (for audit trail)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
)

// Indexes for better query performance and multi-tenancy
userSchema.index({ email: 1, website: 1 }, { unique: true, partialFilterExpression: { deleted: false } });
userSchema.index({ website: 1, deleted: 1, isActive: 1 });
userSchema.index({ role: 1, website: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ accessibleWebsites: 1 });
userSchema.index({ username: 1 }, { unique: true, sparse: true });
userSchema.index({ permissions: 1 });

// Method to check if user has a specific permission
userSchema.methods.hasPermission = function(permissionKey) {
  // Super admin has all permissions
  if (this.role === 'super_admin') return true
  
  // Check if permission exists in user's permissions array
  return this.permissions && this.permissions.includes(permissionKey)
}

// Method to check if user has any of the given permissions
userSchema.methods.hasAnyPermission = function(permissionKeys) {
  if (this.role === 'super_admin') return true
  if (!this.permissions || !Array.isArray(permissionKeys)) return false
  return permissionKeys.some(key => this.permissions.includes(key))
}

// Method to check if user has all of the given permissions
userSchema.methods.hasAllPermissions = function(permissionKeys) {
  if (this.role === 'super_admin') return true
  if (!this.permissions || !Array.isArray(permissionKeys)) return false
  return permissionKeys.every(key => this.permissions.includes(key))
}

// Method to check if account is locked
userSchema.methods.isLocked = function() {
  return this.lockedUntil && this.lockedUntil > new Date()
}

// Method to record failed login
userSchema.methods.recordFailedLogin = async function() {
  this.failedLoginAttempts += 1
  
  // Lock account after 5 failed attempts for 30 minutes
  if (this.failedLoginAttempts >= 5) {
    this.lockedUntil = new Date(Date.now() + 30 * 60 * 1000)
  }
  
  await this.save()
}

// Method to reset failed login attempts
userSchema.methods.resetFailedLogins = async function() {
  this.failedLoginAttempts = 0
  this.lockedUntil = null
  this.lastLoginAt = new Date()
  await this.save()
}

userSchema.pre("save", async function (next) {
  // Only hash password if it's modified and exists (not for Google OAuth users)
  if (!this.isModified("password") || !this.password) return next()
  this.password = await bcrypt.hash(this.password, 10)
  next()
})

userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!enteredPassword || !this.password) return false
  return await bcrypt.compare(enteredPassword, this.password)
}

export default mongoose.model("User", userSchema)
