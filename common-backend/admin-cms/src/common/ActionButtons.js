import React from 'react';

const ActionButtons = ({ 
  // Actions
  onEdit = null,
  onDelete = null,
  onView = null,
  onToggleStatus = null,
  onDuplicate = null,
  onExport = null,
  onImport = null,
  onRevert = null, // Add revert action
  
  // Custom actions
  customActions = [],
  
  // Button text customization
  editText = "✏️ Edit",
  deleteText = "🗑️ Delete",
  viewText = "👁️ View",
  toggleStatusText = null,
  duplicateText = "📋 Duplicate",
  exportText = "📤 Export",
  importText = "📥 Import",
  revertText = "🔄 Revert", // Add revert text
  
  // Button titles (tooltips)
  editTitle = "Edit",
  deleteTitle = "Delete",
  viewTitle = "View Details",
  toggleStatusTitle = null,
  duplicateTitle = "Duplicate",
  exportTitle = "Export",
  importTitle = "Import",
  revertTitle = "Revert", // Add revert title
  
  // Button styling
  size = "normal", // "small", "normal", "large"
  variant = "default", // "default", "compact", "minimal", "icon-only"
  layout = "horizontal", // "horizontal", "vertical", "grid"
  
  // State
  loading = false,
  disabled = false,
  editDisabled = false,
  deleteDisabled = false,
  viewDisabled = false,
  toggleStatusDisabled = false,
  revertDisabled = false, // Add revert disabled state
  
  // Styling
  className = "",
  buttonClassName = "",
  
  // Additional props
  ...props
}) => {
  
  // Size-based classes
  const sizeClasses = {
    small: 'actionButtonsSmall',
    normal: 'actionButtonsNormal',
    large: 'actionButtonsLarge'
  };

  // Variant-based classes
  const variantClasses = {
    default: 'actionButtonsDefault',
    compact: 'actionButtonsCompact',
    minimal: 'actionButtonsMinimal',
    'icon-only': 'actionButtonsIconOnly'
  };

  // Layout-based classes
  const layoutClasses = {
    horizontal: 'actionButtonsHorizontal',
    vertical: 'actionButtonsVertical',
    grid: 'actionButtonsGrid'
  };

  const containerClassName = `actionButtons ${sizeClasses[size]} ${variantClasses[variant]} ${layoutClasses[layout]} ${className}`;

  // Generate toggle status text if not provided
  const getToggleStatusText = () => {
    if (toggleStatusText) return toggleStatusText;
    return props.isActive ? "⏸️ Deactivate" : "▶️ Activate";
  };

  const getToggleStatusTitle = () => {
    if (toggleStatusTitle) return toggleStatusTitle;
    return props.isActive ? "Deactivate" : "Activate";
  };

  // Render individual button
  const renderButton = (onClick, text, title, disabled, className = "") => {
    if (!onClick) return null;
    
    return (
      <button
        onClick={onClick}
        className={`actionButton ${className} ${buttonClassName}`}
        disabled={loading || disabled}
        title={title}
      >
        {text}
      </button>
    );
  };

  // Render custom actions
  const renderCustomActions = () => {
    if (!customActions || customActions.length === 0) return null;
    
    return customActions.map((action, index) => (
      <div key={index} className="actionButton customAction">
        {action}
      </div>
    ));
  };

  return (
    <div className={containerClassName} {...props}>
      {/* View button */}
      {renderButton(
        onView, 
        viewText, 
        viewTitle, 
        viewDisabled, 
        'btnView'
      )}
      
      {/* Edit button */}
      {renderButton(
        onEdit, 
        editText, 
        editTitle, 
        editDisabled, 
        'btnEdit'
      )}
      
      {/* Toggle status button */}
      {renderButton(
        onToggleStatus, 
        getToggleStatusText(), 
        getToggleStatusTitle(), 
        toggleStatusDisabled, 
        'btnToggleStatus'
      )}
      
      {/* Duplicate button */}
      {renderButton(
        onDuplicate, 
        duplicateText, 
        duplicateTitle, 
        false, 
        'btnDuplicate'
      )}
      
      {/* Export button */}
      {renderButton(
        onExport, 
        exportText, 
        exportTitle, 
        false, 
        'btnExport'
      )}
      
      {/* Import button */}
      {renderButton(
        onImport, 
        importText, 
        importTitle, 
        false, 
        'btnImport'
      )}
      
      {/* Revert button */}
      {renderButton(
        onRevert, 
        revertText, 
        revertTitle, 
        revertDisabled, 
        'btnRevert'
      )}
      
      {/* Delete button */}
      {renderButton(
        onDelete, 
        deleteText, 
        deleteTitle, 
        deleteDisabled, 
        'btnDelete'
      )}
      
      {/* Custom actions */}
      {renderCustomActions()}
    </div>
  );
};

export default ActionButtons; 