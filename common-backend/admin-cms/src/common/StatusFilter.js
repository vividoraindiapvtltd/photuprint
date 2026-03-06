import React from 'react';

const StatusFilter = ({ 
  statusFilter, 
  onStatusChange, 
  counts, 
  statusCounts, // Accept both counts and statusCounts for backward compatibility
  disabled = false,
  className = "",
  statusOptions = null, // Allow custom status options
  showCounts = true // Option to hide counts
}) => {
  // Use counts or statusCounts, whichever is provided
  const statusCountsData = counts || statusCounts || { total: 0, active: 0, inactive: 0, deleted: 0 };
  
  // Default status options for standard entities
  const defaultStatusOptions = [
    { key: 'all', label: 'All', count: statusCountsData.total, color: 'black' },
    { key: 'active', label: 'Active', count: statusCountsData.active, color: 'green' },
    { key: 'inactive', label: 'Inactive', count: statusCountsData.inactive, color: 'gray' },
    { key: 'deleted', label: 'Deleted', count: statusCountsData.deleted, color: 'red' }
  ];

  // Use custom status options if provided, otherwise use defaults
  const options = statusOptions || defaultStatusOptions;

  // Get color class based on status
  const getColorClass = (color) => {
    if (!color) return '';
    
    switch (color.toLowerCase()) {
      case 'black':
        return 'statusFilterBlack';
      case 'green':
        return 'statusFilterGreen';
      case 'red':
        return 'statusFilterRed';
      case 'gray':
        return 'statusFilterGray';
      case 'blue':
        return 'statusFilterBlue';
      case 'orange':
        return 'statusFilterOrange';
      case 'purple':
        return 'statusFilterPurple';
      default:
        return '';
    }
  };

  return (
    <div className={`statusFilters makeFlex gap10 appendTop8 ${className}`}>
      {options.map(({ key, label, count, color }) => (
        <button
          key={key}
          className={`statusFilterBtn ${statusFilter === key ? 'active' : ''} ${getColorClass(color)}`}
          onClick={() => onStatusChange(key)}
          disabled={disabled}
          title={`Show ${label.toLowerCase()} items`}
        >
          {label} {showCounts && `(${count})`}
        </button>
      ))}
    </div>
  );
};

export default StatusFilter; 