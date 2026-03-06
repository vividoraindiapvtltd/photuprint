/**
 * Utility functions for calculating status counts across different entity types
 */

/**
 * Calculate standard status counts for entities with isActive and deleted fields
 * @param {Array} entities - Array of entity objects
 * @returns {Object} Object with total, active, inactive, and deleted counts
 */
export const calculateStandardStatusCounts = (entities) => {
  return {
    total: entities.length,
    active: entities.filter(entity => entity.isActive && !entity.deleted).length,
    inactive: entities.filter(entity => !entity.isActive && !entity.deleted).length,
    deleted: entities.filter(entity => entity.deleted).length
  };
};

/**
 * Calculate custom status counts based on a status field
 * @param {Array} entities - Array of entity objects
 * @param {string} statusField - Field name to check for status
 * @param {Object} statusMapping - Mapping of status values to labels
 * @returns {Object} Object with counts for each status
 */
export const calculateCustomStatusCounts = (entities, statusField, statusMapping) => {
  const counts = {
    total: entities.length
  };

  // Initialize counts for each status
  Object.keys(statusMapping).forEach(key => {
    counts[key] = 0;
  });

  // Count entities for each status
  entities.forEach(entity => {
    const status = entity[statusField];
    if (status && statusMapping[status]) {
      counts[status]++;
    }
  });

  return counts;
};

/**
 * Filter entities based on status filter
 * @param {Array} entities - Array of entity objects
 * @param {string} statusFilter - Current status filter ('all', 'active', 'inactive', 'deleted')
 * @param {string} statusField - Field name for status (defaults to standard isActive/deleted)
 * @returns {Array} Filtered array of entities
 */
export const filterEntitiesByStatus = (entities, statusFilter, statusField = null) => {
  if (statusFilter === 'all') {
    return entities;
  }

  if (statusField) {
    // Custom status filtering
    return entities.filter(entity => entity[statusField] === statusFilter);
  } else {
    // Standard status filtering
    switch (statusFilter) {
      case 'active':
        return entities.filter(entity => entity.isActive && !entity.deleted);
      case 'inactive':
        return entities.filter(entity => !entity.isActive && !entity.deleted);
      case 'deleted':
        return entities.filter(entity => entity.deleted);
      default:
        return entities;
    }
  }
};

/**
 * Create status options for StatusFilter component
 * @param {Object} counts - Status counts object
 * @param {Array} customOptions - Custom status options array
 * @returns {Array} Array of status options for StatusFilter
 */
export const createStatusOptions = (counts, customOptions = null) => {
  if (customOptions) {
    return customOptions.map(option => ({
      ...option,
      count: counts[option.key] || 0
    }));
  }

  // Default status options
  return [
    { key: 'all', label: 'All', count: counts.total },
    { key: 'active', label: 'Active', count: counts.active },
    { key: 'inactive', label: 'Inactive', count: counts.inactive },
    { key: 'deleted', label: 'Deleted', count: counts.deleted }
  ];
}; 