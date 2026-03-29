import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

/**
 * Permission Context
 * 
 * Provides RBAC functionality throughout the application:
 * - Stores user permissions
 * - Provides permission checking methods
 * - Handles Super Admin bypass logic
 */

const PermissionContext = createContext(null);

/**
 * Permission to sidebar mapping
 * Maps permission keys to dashboard link IDs
 */
const PERMISSION_MENU_MAP = {
  // Dashboard
  dashboard_view: ['dashboard'],
  
  // Brand Manager
  brands_view: [1],
  brands_create: [1],
  brands_edit: [1],
  brands_manage: [1],
  
  // Category Manager
  categories_view: [2],
  categories_create: [2],
  categories_edit: [2],
  categories_manage: [2],
  
  // Sub Category Manager
  subcategories_view: [15],
  subcategories_manage: [15],
  
  // Product Manager
  products_view: [19],
  products_create: [19],
  products_edit: [19],
  products_manage: [19],
  
  // Homepage Settings
  homepage_view: [34, 54],
  homepage_manage: [34, 54],
  
  // Collar Style
  attributes_view: [3, 4, 5, 6, 7, 8, 9, 10, 13, 14, 16, 26, 27, 66, 67],
  attributes_manage: [3, 4, 5, 6, 7, 8, 9, 10, 13, 14, 16, 26, 27, 66, 67],
  
  // Reviews
  reviews_view: [12],
  reviews_approve: [12],
  reviews_manage: [12],
  
  // Testimonials
  testimonials_view: [33],
  testimonials_manage: [33],
  
  // Users
  users_view: [20, 57],
  users_create: [20, 57],
  users_edit: [20, 57],
  users_manage: [20, 57],
  
  // User Access Management
  user_access_view: [36],
  user_access_manage: [36],
  
  // Clients (CRM)
  clients_view: [35],
  clients_create: [35],
  clients_edit: [35],
  clients_manage: [35],

  // Download Leads, Incentive Manager, Incentive Report (explicit permissions)
  leads_download_view: [58],
  incentives_view: [59],
  incentive_report_view: [60],
  
  // Orders
  orders_view: [21, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 63, 64, 65],
  orders_edit: [21],
  orders_manage: [21, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 63, 64, 65],
  
  // Shipping
  shipping_view: [22, 27],
  shipping_manage: [22, 27],
  
  // Coupons
  coupons_view: [17],
  coupons_manage: [17],
  
  // Templates
  templates_view: [18],
  templates_manage: [18],
  
  // PixelCraft
  pixelcraft_view: [28, 29, 30, 31, 32],
  pixelcraft_manage: [28, 29, 30, 31, 32],
  
  // Settings
  settings_view: [23, 24],
  settings_manage: [23, 24],

  // Reports
  reports_view: [37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52],
  // Wallet & cashback (same as orders for RBAC)
  wallet_view: [63, 64, 65],
  wallet_manage: [63, 64, 65],

  // Company
  company_view: [24],
  company_manage: [24],
  
  // Website/Tenant
  websites_view: [25],
  websites_manage: [25],
};

/**
 * Menu ID to required permissions mapping
 * Each menu item ID maps to the permissions that grant access
 */
const MENU_PERMISSION_MAP = {
  // Dashboard Home
  'dashboard': ['dashboard_view'],
  
  // Brand Manager
  1: ['brands_view', 'brands_manage'],
  
  // Category Manager
  2: ['categories_view', 'categories_manage'],
  
  // Sub Category Manager
  15: ['categories_view', 'categories_manage', 'subcategories_view', 'subcategories_manage'],
  
  // Variation Manager
  26: ['attributes_view', 'attributes_manage'],
  
  // Product Manager
  19: ['products_view', 'products_manage'],
  
  // Homepage Settings
  34: ['homepage_view', 'homepage_manage'],
  
  // Collar Style Manager
  3: ['attributes_view', 'attributes_manage'],
  
  // Color Manager
  4: ['attributes_view', 'attributes_manage'],
  
  // Country Manager
  5: ['attributes_view', 'attributes_manage'],
  
  // Fit Type Manager
  6: ['attributes_view', 'attributes_manage'],

  // Capacity Manager
  66: ['attributes_view', 'attributes_manage'],

  // GSM Manager
  67: ['attributes_view', 'attributes_manage'],
  
  // Printing Type Manager
  27: ['attributes_view', 'attributes_manage'],

  // Print Side Manager
  61: ['attributes_view', 'attributes_manage'],

  // Product Add-ons Manager
  62: ['attributes_view', 'attributes_manage'],
  
  // Height Manager
  7: ['attributes_view', 'attributes_manage'],
  
  // Length Manager
  8: ['attributes_view', 'attributes_manage'],
  
  // Material Manager
  9: ['attributes_view', 'attributes_manage'],
  
  // Pattern Manager
  10: ['attributes_view', 'attributes_manage'],
  
  // Pincode Manager
  11: ['attributes_view', 'attributes_manage', 'shipping_view', 'shipping_manage'],
  
  // Review Manager
  12: ['reviews_view', 'reviews_manage', 'reviews_approve'],
  
  // Testimonial Manager
  33: ['testimonials_view', 'testimonials_manage'],
  
  // Size Manager
  13: ['attributes_view', 'attributes_manage'],
  
  // Sleeve Type Manager
  14: ['attributes_view', 'attributes_manage'],
  
  // Width Manager
  16: ['attributes_view', 'attributes_manage'],
  
  // Coupon Manager
  17: ['coupons_view', 'coupons_manage'],
  
  // Template Manager
  18: ['templates_view', 'templates_manage'],
  
  // User Manager
  20: ['users_view', 'users_manage'],
  
  // Client Management
  35: ['clients_view', 'clients_manage'],
  
  // User Access Manager
  36: ['user_access_view', 'user_access_manage'],
  
  // Order Manager
  21: ['orders_view', 'orders_manage'],

  // Wallet & cashback
  63: ['orders_view', 'orders_manage', 'wallet_view', 'wallet_manage'],
  64: ['orders_view', 'orders_manage', 'wallet_view', 'wallet_manage'],
  65: ['orders_view', 'orders_manage', 'wallet_view', 'wallet_manage'],
  
  // Shipping Manager
  22: ['shipping_view', 'shipping_manage'],
  
  // Shipping Cost Manager
  // Product Cost Calculator
  53: ['orders_view', 'orders_manage'],
  
  // GST Slab Manager
  23: ['settings_view', 'settings_manage'],
  
  // Company Manager
  24: ['company_view', 'company_manage', 'settings_view', 'settings_manage'],
  
  // Website Manager
  25: ['websites_view', 'websites_manage'],
  
  // PixelCraft
  28: ['pixelcraft_view', 'pixelcraft_manage'],
  
  // Element Manager
  29: ['pixelcraft_view', 'pixelcraft_manage'],
  
  // Element Images
  30: ['pixelcraft_view', 'pixelcraft_manage'],
  
  // Template Dimensions
  31: ['pixelcraft_view', 'pixelcraft_manage'],
  
  // Image to Vector
  32: ['pixelcraft_view', 'pixelcraft_manage'],

  // Reports
  37: ['orders_view', 'orders_manage', 'reports_view'],
  38: ['orders_view', 'orders_manage', 'reports_view'],
  39: ['orders_view', 'orders_manage', 'reports_view'],
  40: ['orders_view', 'orders_manage', 'reports_view'],
  41: ['orders_view', 'orders_manage', 'reports_view'],
  42: ['orders_view', 'orders_manage', 'reports_view'],
  43: ['orders_view', 'orders_manage', 'reports_view'],
  44: ['orders_view', 'orders_manage', 'reports_view'],
  45: ['orders_view', 'orders_manage', 'reports_view'],
  46: ['orders_view', 'orders_manage', 'reports_view'],
  47: ['orders_view', 'orders_manage', 'reports_view'],
  48: ['orders_view', 'orders_manage', 'reports_view'],
  49: ['orders_view', 'orders_manage', 'reports_view'],
  50: ['orders_view', 'orders_manage', 'reports_view'],
  51: ['orders_view', 'orders_manage', 'reports_view'],
  52: ['orders_view', 'orders_manage', 'reports_view'],
};

/**
 * Route to required permissions mapping
 * Maps frontend routes to required permission keys
 */
export const ROUTE_PERMISSION_MAP = {
  '/dashboard': ['dashboard_view'],
  '/dashboard/addbrand': ['brands_view', 'brands_manage'],
  '/dashboard/addcategory': ['categories_view', 'categories_manage'],
  '/dashboard/addsubcategory': ['categories_view', 'subcategories_view', 'subcategories_manage'],
  '/dashboard/variationmanager': ['attributes_view', 'attributes_manage'],
  '/dashboard/addproducts': ['products_view', 'products_manage'],
  '/dashboard/homepage-sections': ['homepage_view', 'homepage_manage'],
  '/dashboard/frontend': ['homepage_view', 'homepage_manage'],
  '/dashboard/footer-sections': ['homepage_view', 'homepage_manage'],
  '/dashboard/footer-settings': ['homepage_view', 'homepage_manage'],
  '/dashboard/addcollarstyle': ['attributes_view', 'attributes_manage'],
  '/dashboard/addcolor': ['attributes_view', 'attributes_manage'],
  '/dashboard/addcountryoforigin': ['attributes_view', 'attributes_manage'],
  '/dashboard/addfittype': ['attributes_view', 'attributes_manage'],
  '/dashboard/addcapacity': ['attributes_view', 'attributes_manage'],
  '/dashboard/addgsm': ['attributes_view', 'attributes_manage'],
  '/dashboard/addprintingtype': ['attributes_view', 'attributes_manage'],
  '/dashboard/addprintside': ['attributes_view', 'attributes_manage'],
  '/dashboard/addproductaddon': ['attributes_view', 'attributes_manage'],
  '/dashboard/addheight': ['attributes_view', 'attributes_manage'],
  '/dashboard/addlength': ['attributes_view', 'attributes_manage'],
  '/dashboard/addmaterial': ['attributes_view', 'attributes_manage'],
  '/dashboard/addpattern': ['attributes_view', 'attributes_manage'],
  '/dashboard/addpincode': ['attributes_view', 'shipping_view', 'shipping_manage'],
  '/dashboard/reviewmanager': ['reviews_view', 'reviews_manage'],
  '/dashboard/testimonialmanager': ['testimonials_view', 'testimonials_manage'],
  '/dashboard/addsize': ['attributes_view', 'attributes_manage'],
  '/dashboard/addsleevetype': ['attributes_view', 'attributes_manage'],
  '/dashboard/addwidth': ['attributes_view', 'attributes_manage'],
  '/dashboard/addcoupon': ['coupons_view', 'coupons_manage'],
  '/dashboard/templatemanager': ['templates_view', 'templates_manage'],
  '/dashboard/adduser': ['users_view', 'users_manage'],
  '/dashboard/clients': ['clients_view', 'clients_manage'],
  '/dashboard/leads-download': ['leads_download_view'],
  '/dashboard/incentives': ['incentives_view'],
  '/dashboard/incentive-report': ['incentive_report_view'],
  '/dashboard/user-access': ['user_access_view', 'user_access_manage'],
  '/dashboard/addorder': ['orders_view', 'orders_manage'],
  '/dashboard/addshipping': ['shipping_view', 'shipping_manage'],
  '/dashboard/shipping-cost-manager': ['shipping_view', 'shipping_manage'],
  '/dashboard/product-cost-calculator': ['orders_view', 'orders_manage'],
  '/dashboard/addgstslab': ['settings_view', 'settings_manage'],
  '/dashboard/addcompany': ['company_view', 'company_manage'],
  '/dashboard/addwebsite': ['websites_view', 'websites_manage'],
  '/dashboard/pixelcraft': ['pixelcraft_view', 'pixelcraft_manage'],
  '/dashboard/pixelcraft/elements': ['pixelcraft_view', 'pixelcraft_manage'],
  '/dashboard/pixelcraft/element-images': ['pixelcraft_view', 'pixelcraft_manage'],
  '/dashboard/pixelcraft/dimensions': ['pixelcraft_view', 'pixelcraft_manage'],
  '/dashboard/pixelcraft/image-to-vector': ['pixelcraft_view', 'pixelcraft_manage'],
  '/dashboard/wallet-cashback': ['orders_view', 'orders_manage', 'wallet_view', 'wallet_manage'],
  '/dashboard/wallet-cashback/rules': ['orders_view', 'orders_manage', 'wallet_view', 'wallet_manage'],
  '/dashboard/wallet-cashback/ledger': ['orders_view', 'orders_manage', 'wallet_view', 'wallet_manage'],
};

export const PermissionProvider = ({ children }) => {
  const [permissions, setPermissions] = useState([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);

  // Load permissions from localStorage on mount
  useEffect(() => {
    const loadPermissions = () => {
      try {
        // Try to get user from 'user' key first, then fall back to 'adminUser'
        let user = null;
        const userStr = localStorage.getItem('user');
        const adminUserStr = localStorage.getItem('adminUser');
        
        if (userStr) {
          user = JSON.parse(userStr);
        } else if (adminUserStr) {
          // Fall back to adminUser and extract user data
          const adminData = JSON.parse(adminUserStr);
          user = adminData?.user || adminData;
        }
        
        if (!user) {
          setPermissions([]);
          setIsSuperAdmin(false);
          setRole(null);
          setLoading(false);
          return;
        }
        
        const storedPermissions = user.permissions || [];
        const storedRole = user.role || null;
        
        // Check if user is super admin - be strict about this check
        const isSuper = storedRole === 'super_admin' || 
                        user.isSuperAdmin === true || 
                        storedPermissions.includes('*');
        
        console.log('PermissionContext loaded:', { 
          email: user.email,
          role: storedRole, 
          isSuperAdmin: isSuper, 
          permissions: storedPermissions 
        });
        
        setPermissions(storedPermissions);
        setIsSuperAdmin(isSuper);
        setRole(storedRole);
      } catch (error) {
        console.error('Error loading permissions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
    
    // Listen for storage changes (e.g., login/logout in another tab)
    window.addEventListener('storage', loadPermissions);
    
    // Listen for login events to refresh permissions
    window.addEventListener('userLogin', loadPermissions);
    
    return () => {
      window.removeEventListener('storage', loadPermissions);
      window.removeEventListener('userLogin', loadPermissions);
    };
  }, []);

  // Fetch fresh permissions from server
  const refreshPermissions = useCallback(async () => {
    try {
      const response = await api.get('/user-access/my-permissions');
      const { permissions: newPermissions, isSuperAdmin: isSuper, role: newRole } = response.data;
      
      setPermissions(newPermissions);
      setIsSuperAdmin(isSuper);
      setRole(newRole);
      
      // Update localStorage
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      user.permissions = newPermissions;
      user.isSuperAdmin = isSuper;
      localStorage.setItem('user', JSON.stringify(user));
      
      return { permissions: newPermissions, isSuperAdmin: isSuper };
    } catch (error) {
      console.error('Error refreshing permissions:', error);
      return null;
    }
  }, []);

  /**
   * Check if user has a specific permission
   */
  const hasPermission = useCallback((permissionKey) => {
    // Super admin has all permissions
    if (isSuperAdmin) return true;
    if (permissions.includes('*')) return true;
    
    return permissions.includes(permissionKey);
  }, [permissions, isSuperAdmin]);

  /**
   * Check if user has any of the specified permissions
   */
  const hasAnyPermission = useCallback((permissionKeys) => {
    if (isSuperAdmin) return true;
    if (permissions.includes('*')) return true;
    
    return permissionKeys.some(key => permissions.includes(key));
  }, [permissions, isSuperAdmin]);

  /**
   * Check if user has all of the specified permissions
   */
  const hasAllPermissions = useCallback((permissionKeys) => {
    if (isSuperAdmin) return true;
    if (permissions.includes('*')) return true;
    
    return permissionKeys.every(key => permissions.includes(key));
  }, [permissions, isSuperAdmin]);

  /**
   * Check if user can access a specific menu item
   */
  const canAccessMenu = useCallback((menuId) => {
    if (isSuperAdmin) return true;
    if (permissions.includes('*')) return true;
    
    // Double-check role from localStorage as fallback
    try {
      const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
      const userFromStorage = JSON.parse(localStorage.getItem('user') || '{}');
      const userRole = adminUser?.user?.role || userFromStorage?.role;
      if (userRole === 'super_admin') return true;
    } catch (e) {
      // Ignore parsing errors
    }
    
    const requiredPermissions = MENU_PERMISSION_MAP[menuId];
    if (!requiredPermissions) return true; // No restriction defined
    
    return requiredPermissions.some(key => permissions.includes(key));
  }, [permissions, isSuperAdmin]);

  /**
   * Check if user can access a specific route
   */
  const canAccessRoute = useCallback((routePath) => {
    // Check isSuperAdmin from context
    if (isSuperAdmin) return true;
    if (permissions.includes('*')) return true;
    
    // Double-check role from localStorage as fallback
    try {
      const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
      const userFromStorage = JSON.parse(localStorage.getItem('user') || '{}');
      const userRole = adminUser?.user?.role || userFromStorage?.role;
      if (userRole === 'super_admin') return true;
    } catch (e) {
      // Ignore parsing errors
    }
    
    const requiredPermissions = ROUTE_PERMISSION_MAP[routePath];
    if (!requiredPermissions) return true; // No restriction defined
    
    return requiredPermissions.some(key => permissions.includes(key));
  }, [permissions, isSuperAdmin]);

  /**
   * Filter menu items based on user permissions
   */
  const filterMenuItems = useCallback((menuItems) => {
    if (isSuperAdmin || permissions.includes('*')) {
      return menuItems;
    }
    
    // Double-check role from localStorage as fallback
    try {
      const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
      const userFromStorage = JSON.parse(localStorage.getItem('user') || '{}');
      const userRole = adminUser?.user?.role || userFromStorage?.role;
      if (userRole === 'super_admin') return menuItems;
    } catch (e) {
      // Ignore parsing errors
    }
    
    return menuItems.filter(item => canAccessMenu(item.id));
  }, [isSuperAdmin, permissions, canAccessMenu]);

  /**
   * Update permissions (called after login)
   */
  const updatePermissions = useCallback((newPermissions, isSuper = false, newRole = null) => {
    setPermissions(newPermissions);
    setIsSuperAdmin(isSuper);
    if (newRole) setRole(newRole);
  }, []);

  /**
   * Clear permissions (called on logout)
   */
  const clearPermissions = useCallback(() => {
    setPermissions([]);
    setIsSuperAdmin(false);
    setRole(null);
  }, []);

  const value = {
    permissions,
    isSuperAdmin,
    role,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessMenu,
    canAccessRoute,
    filterMenuItems,
    updatePermissions,
    clearPermissions,
    refreshPermissions,
    MENU_PERMISSION_MAP,
    ROUTE_PERMISSION_MAP,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};

/**
 * Hook to use permission context
 */
export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};

export default PermissionContext;
