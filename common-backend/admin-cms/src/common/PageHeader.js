import React from 'react';

const PageHeader = ({ 
  // Basic content
  title, 
  subtitle = null,
  description = null,
  
  // Mode-based content
  isEditing = false, 
  editText = "Edit", 
  createText = "Add New",
  
  // Custom content
  customTitle = null,
  customSubtitle = null,
  
  // Actions
  actions = null,
  leftActions = null,
  rightActions = null,
  
  // Layout
  layout = 'default', // 'default', 'compact', 'detailed', 'centered'
  size = 'normal', // 'small', 'normal', 'large'
  
  // Styling
  className = "",
  titleClassName = "",
  subtitleClassName = "",
  
  // Additional props
  ...props
}) => {
  
  // Layout-based classes
  const layoutClasses = {
    default: 'pageHeaderDefault',
    compact: 'pageHeaderCompact',
    detailed: 'pageHeaderDetailed',
    centered: 'pageHeaderCentered'
  };

  // Size-based classes
  const sizeClasses = {
    small: 'pageHeaderSmall',
    normal: 'pageHeaderNormal',
    large: 'pageHeaderLarge'
  };

  const headerClassName = `pageHeader ${layoutClasses[layout]} ${sizeClasses[size]} ${className}`;
  
  // Determine what to display
  const displayTitle = customTitle || (isEditing ? editText : createText);
  const displaySubtitle = customSubtitle || subtitle;
  
  // Render actions
  const renderActions = (actionList, position) => {
    if (!actionList || actionList.length === 0) return null;
    
    return (
      <div className={`pageHeaderActions pageHeaderActions${position}`}>
        {Array.isArray(actionList) ? actionList.map((action, index) => (
          <div key={index} className="pageHeaderAction">
            {action}
          </div>
        )) : actionList}
      </div>
    );
  };

  return (
    <div className={headerClassName} {...props}>
      <div className="pageHeaderContent">
        {/* Left Actions */}
        {leftActions && (
          <div className="pageHeaderLeft">
            {renderActions(leftActions, 'Left')}
          </div>
        )}
        
        {/* Main Content */}
        <div className="pageHeaderMain">
          {displayTitle && (
            <h1 className={`pageHeaderTitle ${titleClassName}`}>
              {displayTitle}
            </h1>
          )}
          
          {displaySubtitle && (
            <p className={`pageHeaderSubtitle ${subtitleClassName}`}>
              {displaySubtitle}
            </p>
          )}
          
          {description && (
            <div className="pageHeaderDescription">
              {description}
            </div>
          )}
        </div>
        
        {/* Right Actions */}
        {rightActions && (
          <div className="pageHeaderRight">
            {renderActions(rightActions, 'Right')}
          </div>
        )}
        
        {/* General Actions (below content) */}
        {actions && (
          <div className="pageHeaderActions pageHeaderActionsBottom">
            {renderActions(actions, 'Bottom')}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeader; 