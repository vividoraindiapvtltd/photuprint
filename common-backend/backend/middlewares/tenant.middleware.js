import Website from '../models/website.model.js';

/**
 * Tenant Resolution Middleware
 * 
 * For Admin/CMS requests:
 * - Reads X-Website-Id header
 * - Validates admin has access to the website
 * - Attaches website to req.tenant
 * 
 * For Storefront requests:
 * - Resolves website from request domain (Host or X-Forwarded-Host)
 * - Attaches website to req.tenant
 * 
 * Rejects requests if website cannot be resolved or is invalid.
 */

/**
 * Resolve tenant from X-Website-Id header (for admin/CMS)
 */
export const resolveTenantFromHeader = async (req, res, next) => {
  try {
    // Skip tenant resolution for auth routes (login, register, etc.)
    // These routes don't need website context
    if (req.path.startsWith('/api/auth') || req.path.startsWith('/auth')) {
      return next();
    }
    
    const websiteId = req.headers['x-website-id'] || req.headers['X-Website-Id'];
    
    if (!websiteId) {
      return res.status(400).json({ 
        msg: 'X-Website-Id header is required for this requests',
        code: 'MISSING_WEBSITE_ID'
      });
    }

    // Validate ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(websiteId)) {
      return res.status(400).json({ 
        msg: 'Invalid website ID format',
        code: 'INVALID_WEBSITE_ID'
      });
    }

    // Find website
    const website = await Website.findOne({ 
      _id: websiteId,
      deleted: false 
    });

    if (!website) {
      return res.status(404).json({ 
        msg: 'Website not found or has been deleted',
        code: 'WEBSITE_NOT_FOUND'
      });
    }

    if (!website.isActive) {
      return res.status(403).json({ 
        msg: 'Website is not active',
        code: 'WEBSITE_INACTIVE'
      });
    }

    // Check if user has access to this website (if user is authenticated)
    if (req.user) {
      const user = req.user;
      
      // Super admin and admin roles have access to all websites
      if (user.role === 'admin' || user.role === 'super_admin') {
        req.tenant = website;
        req.websiteId = website._id;
        return next();
      }

      // Check if user has access to this website
      const hasAccess = 
        user.website?.toString() === websiteId ||
        (user.accessibleWebsites && user.accessibleWebsites.some(w => w.toString() === websiteId));

      if (!hasAccess) {
        return res.status(403).json({ 
          msg: 'You do not have access to this website',
          code: 'WEBSITE_ACCESS_DENIED'
        });
      }
    }

    // Attach website to request
    req.tenant = website;
    req.websiteId = website._id;
    next();
  } catch (error) {
    console.error('Error resolving tenant from header:', error);
    res.status(500).json({ 
      msg: 'Failed to resolve tenant',
      code: 'TENANT_RESOLUTION_ERROR'
    });
  }
};

/**
 * Resolve tenant from domain (for storefront)
 */
export const resolveTenantFromDomain = async (req, res, next) => {
  try {
    // Get domain from Host or X-Forwarded-Host header
    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    const domain = host.split(':')[0]; // Remove port if present

    if (!domain) {
      console.error('Domain resolution failed: No host header found');
      return res.status(400).json({ 
        msg: 'Unable to determine domain from request',
        code: 'DOMAIN_NOT_FOUND',
        receivedHost: host
      });
    }

    console.log(`Resolving tenant from domain: ${domain}`);

    // For local development: if domain is localhost, try to find a default website or first active website
    let website;
    if (domain === 'localhost' || domain === '127.0.0.1') {
      // In development, try to find the first active website as fallback
      if (process.env.NODE_ENV === 'development') {
        website = await Website.findOne({ 
          deleted: false,
          isActive: true
        }).sort({ createdAt: 1 }); // Get the first created website
        
        if (website) {
          console.log(`Development mode: Using default website ${website.name} for localhost`);
        }
      }
    }
    
    // If not found yet, try exact domain match
    if (!website) {
      website = await Website.findOne({ 
        domain: domain.toLowerCase(),
        deleted: false,
        isActive: true
      });
    }

    if (!website) {
      console.error(`Website not found for domain: ${domain}`);
      // List available domains for debugging
      const availableWebsites = await Website.find({ deleted: false, isActive: true }).select('domain name');
      console.log('Available websites:', availableWebsites.map(w => ({ domain: w.domain, name: w.name })));
      
      return res.status(404).json({ 
        msg: 'Website not found for this domain',
        code: 'WEBSITE_NOT_FOUND',
        domain: domain,
        availableDomains: process.env.NODE_ENV === 'development' ? availableWebsites.map(w => w.domain) : undefined
      });
    }

    console.log(`Tenant resolved: ${website.name} (${website.domain})`);

    // Attach website to request
    req.tenant = website;
    req.websiteId = website._id;
    next();
  } catch (error) {
    console.error('Error resolving tenant from domain:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      msg: 'Failed to resolve tenant from domain',
      code: 'TENANT_RESOLUTION_ERROR',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Combined middleware: tries header first (admin), then domain (storefront)
 * Useful for routes that serve both admin and storefront
 */
export const resolveTenant = async (req, res, next) => {
  try {
    const websiteId = req.headers['x-website-id'] || req.headers['X-Website-Id'];
    
    // If X-Website-Id header exists, use header-based resolution (admin)
    if (websiteId) {
      return await resolveTenantFromHeader(req, res, next);
    }
    
    // Otherwise, use domain-based resolution (storefront)
    return await resolveTenantFromDomain(req, res, next);
  } catch (error) {
    console.error('Error in resolveTenant:', error);
    console.error('Request path:', req.path);
    console.error('Request headers:', {
      host: req.headers.host,
      'x-forwarded-host': req.headers['x-forwarded-host'],
      'x-website-id': req.headers['x-website-id']
    });
    res.status(500).json({ 
      msg: 'Failed to resolve tenant',
      code: 'TENANT_RESOLUTION_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Middleware to ensure tenant is set (for routes that require tenant)
 */
export const requireTenant = (req, res, next) => {
  if (!req.tenant || !req.websiteId) {
    return res.status(400).json({ 
      msg: 'Tenant context is required for this operation',
      code: 'TENANT_REQUIRED'
    });
  }
  next();
};

/**
 * Optional tenant middleware - allows super admins to proceed without website context
 * For regular admins, website context is still required
 * If X-Website-Id header is present, always resolve tenant (even for super admins)
 */
export const optionalTenant = async (req, res, next) => {
  try {
    const websiteId = req.headers['x-website-id'] || req.headers['X-Website-Id'];
    
    // If header is present, resolve tenant (this sets req.websiteId)
    if (websiteId) {
      return await resolveTenantFromHeader(req, res, next);
    }
    
    // If no header and super admin or admin, allow to proceed (for "all websites" view)
    if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin')) {
      return next();
    }
    
    // For non-admin users without header, require website context
    return res.status(400).json({ 
      msg: 'Tenant context is required for this operation',
      code: 'TENANT_REQUIRED'
    });
  } catch (error) {
    console.error('Error in optionalTenant:', error);
    return res.status(500).json({ 
      msg: 'Failed to resolve tenant',
      code: 'TENANT_RESOLUTION_ERROR'
    });
  }
};

/**
 * Skip tenant middleware - for routes that don't need tenant context
 * Still resolves tenant if header is present, but doesn't require it
 */
export const skipTenant = async (req, res, next) => {
  try {
    // Check header - Express normalizes headers to lowercase, but check both for safety
    const websiteId = req.headers['x-website-id'] || req.headers['X-Website-Id'];
    
    console.log('[skipTenant] Checking header:', {
      'x-website-id': req.headers['x-website-id'],
      'X-Website-Id': req.headers['X-Website-Id'],
      websiteId,
      allHeaders: Object.keys(req.headers).filter(k => k.toLowerCase().includes('website'))
    });
    
    // If header is present, try to resolve tenant but don't fail if not found
    // Don't check isActive here - let the controller decide based on user role
    if (websiteId && /^[0-9a-fA-F]{24}$/.test(websiteId)) {
      const Website = (await import('../models/website.model.js')).default;
      const website = await Website.findOne({ 
        _id: websiteId, 
        deleted: false
        // Note: Not checking isActive here - controller will handle it based on user role
      });
      if (website) {
        req.tenant = website;
        req.websiteId = website._id;
        console.log('[skipTenant] Website resolved:', website.name, '(active:', website.isActive + ')');
      } else {
        console.warn('[skipTenant] Website not found or deleted:', websiteId);
      }
    } else if (websiteId) {
      console.warn('[skipTenant] Invalid website ID format:', websiteId);
    }
    
    return next();
  } catch (error) {
    console.error('[skipTenant] Error:', error);
    // Don't fail, just proceed without tenant
    return next();
  }
};
