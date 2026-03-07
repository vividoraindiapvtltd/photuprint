import mongoose from "mongoose"

/**
 * Permission Model
 * 
 * Defines all available permissions in the system.
 * Each permission represents access to a specific feature or action.
 * 
 * Permission Keys follow the pattern: module_action
 * Examples: dashboard_view, users_create, orders_edit
 */

const permissionSchema = new mongoose.Schema(
  {
    // Unique permission key (e.g., "dashboard_view", "users_create")
    key: {
      type: String,
      required: [true, "Permission key is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z_]+$/, "Permission key can only contain lowercase letters and underscores"],
    },
    
    // Human-readable label
    label: {
      type: String,
      required: [true, "Permission label is required"],
      trim: true,
      maxlength: [100, "Label cannot exceed 100 characters"],
    },
    
    // Description of what this permission grants
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    
    // Module/Category this permission belongs to
    module: {
      type: String,
      required: [true, "Module is required"],
      trim: true,
      lowercase: true,
      index: true,
    },
    
    // Action type
    action: {
      type: String,
      enum: ["view", "create", "edit", "delete", "manage", "export", "import", "approve"],
      default: "view",
    },
    
    // Sort order for display
    sortOrder: {
      type: Number,
      default: 0,
    },
    
    // Whether this permission is active
    isActive: {
      type: Boolean,
      default: true,
    },
    
    // System permission (cannot be deleted)
    isSystem: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

// Indexes (key: unique true on field above creates { key: 1 }; no duplicate)
permissionSchema.index({ module: 1, action: 1 })
permissionSchema.index({ isActive: 1, sortOrder: 1 })

// Static method to get permissions grouped by module
permissionSchema.statics.getGroupedPermissions = async function() {
  const permissions = await this.find({ isActive: true }).sort({ module: 1, sortOrder: 1 })
  
  const grouped = {}
  permissions.forEach(permission => {
    if (!grouped[permission.module]) {
      grouped[permission.module] = []
    }
    grouped[permission.module].push(permission)
  })
  
  return grouped
}

// Static method to seed default permissions
permissionSchema.statics.seedDefaultPermissions = async function() {
  const defaultPermissions = [
    // Dashboard
    { key: "dashboard_view", label: "View Dashboard", module: "dashboard", action: "view", sortOrder: 1, isSystem: true },
    
    // Brands
    { key: "brands_view", label: "View Brands", module: "brands", action: "view", sortOrder: 1 },
    { key: "brands_create", label: "Create Brands", module: "brands", action: "create", sortOrder: 2 },
    { key: "brands_edit", label: "Edit Brands", module: "brands", action: "edit", sortOrder: 3 },
    { key: "brands_delete", label: "Delete Brands", module: "brands", action: "delete", sortOrder: 4 },
    
    // Categories
    { key: "categories_view", label: "View Categories", module: "categories", action: "view", sortOrder: 1 },
    { key: "categories_create", label: "Create Categories", module: "categories", action: "create", sortOrder: 2 },
    { key: "categories_edit", label: "Edit Categories", module: "categories", action: "edit", sortOrder: 3 },
    { key: "categories_delete", label: "Delete Categories", module: "categories", action: "delete", sortOrder: 4 },
    
    // Products
    { key: "products_view", label: "View Products", module: "products", action: "view", sortOrder: 1 },
    { key: "products_create", label: "Create Products", module: "products", action: "create", sortOrder: 2 },
    { key: "products_edit", label: "Edit Products", module: "products", action: "edit", sortOrder: 3 },
    { key: "products_delete", label: "Delete Products", module: "products", action: "delete", sortOrder: 4 },
    
    // Homepage Settings
    { key: "homepage_view", label: "View Homepage Settings", module: "homepage", action: "view", sortOrder: 1 },
    { key: "homepage_manage", label: "Manage Homepage Settings", module: "homepage", action: "manage", sortOrder: 2 },
    
    // Orders
    { key: "orders_view", label: "View Orders", module: "orders", action: "view", sortOrder: 1 },
    { key: "orders_edit", label: "Edit Orders", module: "orders", action: "edit", sortOrder: 2 },
    { key: "orders_delete", label: "Delete Orders", module: "orders", action: "delete", sortOrder: 3 },
    { key: "orders_export", label: "Export Orders", module: "orders", action: "export", sortOrder: 4 },
    
    // Users
    { key: "users_view", label: "View Users", module: "users", action: "view", sortOrder: 1 },
    { key: "users_create", label: "Create Users", module: "users", action: "create", sortOrder: 2 },
    { key: "users_edit", label: "Edit Users", module: "users", action: "edit", sortOrder: 3 },
    { key: "users_delete", label: "Delete Users", module: "users", action: "delete", sortOrder: 4 },
    
    // User Access Management (Super Admin only typically)
    { key: "user_access_view", label: "View User Access", module: "user_access", action: "view", sortOrder: 1, isSystem: true },
    { key: "user_access_manage", label: "Manage User Access", module: "user_access", action: "manage", sortOrder: 2, isSystem: true },
    
    // Clients (CRM)
    { key: "clients_view", label: "View Clients", module: "clients", action: "view", sortOrder: 1 },
    { key: "clients_create", label: "Create Clients", module: "clients", action: "create", sortOrder: 2 },
    { key: "clients_edit", label: "Edit Clients", module: "clients", action: "edit", sortOrder: 3 },
    { key: "clients_delete", label: "Delete Clients", module: "clients", action: "delete", sortOrder: 4 },
    
    // Reviews
    { key: "reviews_view", label: "View Reviews", module: "reviews", action: "view", sortOrder: 1 },
    { key: "reviews_approve", label: "Approve Reviews", module: "reviews", action: "approve", sortOrder: 2 },
    { key: "reviews_delete", label: "Delete Reviews", module: "reviews", action: "delete", sortOrder: 3 },
    
    // Testimonials
    { key: "testimonials_view", label: "View Testimonials", module: "testimonials", action: "view", sortOrder: 1 },
    { key: "testimonials_manage", label: "Manage Testimonials", module: "testimonials", action: "manage", sortOrder: 2 },
    
    // Coupons
    { key: "coupons_view", label: "View Coupons", module: "coupons", action: "view", sortOrder: 1 },
    { key: "coupons_manage", label: "Manage Coupons", module: "coupons", action: "manage", sortOrder: 2 },
    
    // Templates
    { key: "templates_view", label: "View Templates", module: "templates", action: "view", sortOrder: 1 },
    { key: "templates_manage", label: "Manage Templates", module: "templates", action: "manage", sortOrder: 2 },
    
    // PixelCraft
    { key: "pixelcraft_view", label: "View PixelCraft", module: "pixelcraft", action: "view", sortOrder: 1 },
    { key: "pixelcraft_manage", label: "Manage PixelCraft", module: "pixelcraft", action: "manage", sortOrder: 2 },
    
    // Shipping
    { key: "shipping_view", label: "View Shipping", module: "shipping", action: "view", sortOrder: 1 },
    { key: "shipping_manage", label: "Manage Shipping", module: "shipping", action: "manage", sortOrder: 2 },
    
    // Settings
    { key: "settings_view", label: "View Settings", module: "settings", action: "view", sortOrder: 1 },
    { key: "settings_manage", label: "Manage Settings", module: "settings", action: "manage", sortOrder: 2 },
    
    // Company
    { key: "company_view", label: "View Company", module: "company", action: "view", sortOrder: 1 },
    { key: "company_manage", label: "Manage Company", module: "company", action: "manage", sortOrder: 2 },
    
    // Website/Tenant
    { key: "websites_view", label: "View Websites", module: "websites", action: "view", sortOrder: 1 },
    { key: "websites_manage", label: "Manage Websites", module: "websites", action: "manage", sortOrder: 2, isSystem: true },
    
    // Reports
    { key: "reports_view", label: "View Reports", module: "reports", action: "view", sortOrder: 1 },
    { key: "reports_export", label: "Export Reports", module: "reports", action: "export", sortOrder: 2 },
    
    // Product Attributes
    { key: "attributes_view", label: "View Product Attributes", module: "attributes", action: "view", sortOrder: 1 },
    { key: "attributes_manage", label: "Manage Product Attributes", module: "attributes", action: "manage", sortOrder: 2 },
  ]
  
  for (const permission of defaultPermissions) {
    await this.findOneAndUpdate(
      { key: permission.key },
      permission,
      { upsert: true, new: true }
    )
  }
  
  console.log(`Seeded ${defaultPermissions.length} default permissions`)
  return defaultPermissions.length
}

export default mongoose.model("Permission", permissionSchema)
