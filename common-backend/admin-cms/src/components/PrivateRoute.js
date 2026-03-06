import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '../context/PermissionContext';

/**
 * PrivateRoute Component
 * 
 * Protects routes requiring authentication.
 * Optionally checks for specific permissions.
 * 
 * @param {ReactNode} children - The component to render if authorized
 * @param {string[]} requiredPermissions - Optional array of permission keys (user needs at least one)
 * @param {boolean} requireAll - If true, user must have ALL permissions (default: false = any)
 */
export default function PrivateRoute({ 
  children, 
  requiredPermissions = [], 
  requireAll = false 
}) {
  const { isAuthenticated, selectedWebsite } = useAuth();
  const { hasPermission, hasAnyPermission, hasAllPermissions, canAccessRoute, loading, isSuperAdmin, role } = usePermissions();
  const location = useLocation();
  
  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }
  
  // If authenticated but no website selected, redirect to website selection
  if (!selectedWebsite) {
    return <Navigate to="/select-website" state={{ from: location }} replace />;
  }
  
  // Wait for permissions to load
  if (loading) {
    return (
      <div className="loadingPermissions" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div className="spinner" style={{
          width: '40px',
          height: '40px',
          border: '3px solid #f3f3f3',
          borderTop: '3px solid #007bff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ color: '#6c757d' }}>Loading permissions...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }
  
  // Super admin bypasses all permission checks
  // Check multiple sources to ensure super admin is detected
  let isUserSuperAdmin = isSuperAdmin || role === 'super_admin';
  
  if (!isUserSuperAdmin) {
    try {
      const adminUserData = JSON.parse(localStorage.getItem('adminUser') || '{}');
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      const storedRole = adminUserData?.user?.role || userData?.role;
      const storedIsSuperAdmin = adminUserData?.user?.isSuperAdmin || userData?.isSuperAdmin;
      const storedPermissions = adminUserData?.user?.permissions || userData?.permissions || [];
      
      isUserSuperAdmin = storedRole === 'super_admin' || 
                         storedIsSuperAdmin === true || 
                         storedPermissions.includes('*');
    } catch (e) {
      console.error('Error checking super admin status:', e);
    }
  }
  
  if (isUserSuperAdmin) {
    return children;
  }
  
  // For backward compatibility: if user is admin and no specific permissions were loaded,
  // allow access to routes (permissions system not yet fully configured)
  // This ensures existing admin users aren't locked out
  const adminUserData = JSON.parse(localStorage.getItem('adminUser') || '{}');
  const userRole = adminUserData?.user?.role || role;
  
  if ((userRole === 'admin' || userRole === 'editor') && requiredPermissions.length === 0) {
    // No explicit permissions required for this route, allow admin access
    return children;
  }
  
  // Check explicit permissions if provided
  if (requiredPermissions.length > 0) {
    const hasAccess = requireAll 
      ? hasAllPermissions(requiredPermissions)
      : hasAnyPermission(requiredPermissions);
    
    if (!hasAccess) {
      // For admins without permissions setup, allow access (backward compatibility)
      if ((userRole === 'admin' || userRole === 'editor')) {
        console.warn('Admin user without permissions - allowing access for backward compatibility');
        return children;
      }
      return <Navigate to="/access-denied" state={{ from: location }} replace />;
    }
  }
  
  // Check route-based permissions only if permissions are set up
  const currentPath = location.pathname;
  if (!canAccessRoute(currentPath)) {
    // For admins without permissions setup, allow access (backward compatibility)
    if ((userRole === 'admin' || userRole === 'editor')) {
      console.warn('Admin user without permissions - allowing access for backward compatibility');
      return children;
    }
    return <Navigate to="/access-denied" state={{ from: location }} replace />;
  }
  
  return children;
}

/**
 * PermissionGate Component
 * 
 * Conditionally renders children based on permissions.
 * Use this for showing/hiding UI elements within a page.
 * 
 * @param {ReactNode} children - Content to render if user has permission
 * @param {string|string[]} permission - Permission key(s) required
 * @param {boolean} requireAll - If true and permission is array, user must have ALL
 * @param {ReactNode} fallback - Content to render if user lacks permission
 */
export function PermissionGate({ 
  children, 
  permission, 
  requireAll = false, 
  fallback = null 
}) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();
  
  let hasAccess = false;
  
  if (Array.isArray(permission)) {
    hasAccess = requireAll 
      ? hasAllPermissions(permission)
      : hasAnyPermission(permission);
  } else {
    hasAccess = hasPermission(permission);
  }
  
  return hasAccess ? children : fallback;
}
