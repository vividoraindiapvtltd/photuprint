import React from 'react';

const EntityCard = ({ 
  entity,
  // Image/Logo configuration
  imageField = 'logo',
  imageAltField = 'name',
  showImage = true,
  imagePlaceholderColor = null,
  
  // Text fields configuration
  titleField = 'name',
  subtitleField = null,
  idField = '_id',
  showId = true,
  
  // Date display configuration
  showCreatedAt = false,
  dateField = 'createdAt',
  dateFormat = 'long', // 'short', 'long', 'time'
  
  // Custom rendering functions
  renderHeader = null,
  renderDetails = null,
  renderActions = null,
  renderFooter = null,
  
  // Actions
  onEdit = null,
  onDelete = null,
  onView = null,
  onToggleStatus = null,
  
  // State
  loading = false,
  disabled = false,
  
  // Styling
  className = "",
  size = "normal", // "small", "normal", "large"
  variant = "default", // "default", "compact", "detailed"
  
  // Status display
  showStatus = false,
  statusField = 'isActive',
  statusLabels = { active: 'Active', inactive: 'Inactive' },
  statusColors = { active: 'greenText', inactive: 'redText' },
  
  // Additional props
  ...restProps
}) => {

  const handleEdit = () => onEdit && onEdit(entity);
  const handleDelete = () => onDelete && onDelete(entity[idField]);
  const handleView = () => onView && onView(entity);
  const handleToggleStatus = () => onToggleStatus && onToggleStatus(entity);

  // Size-based classes
  const sizeClasses = {
    small: 'entityCardSmall',
    normal: 'entityCardNormal',
    large: 'entityCardLarge'
  };

  // Variant-based classes
  const variantClasses = {
    default: 'entityCardDefault',
    compact: 'entityCardCompact',
    detailed: 'entityCardDetailed'
  };

  const cardClassName = `entityCard paddingAll24 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`;

  // Extract valid DOM props and exclude custom props that shouldn't be on DOM elements
  // Filter out all custom props to prevent React warnings
  const domProps = Object.keys(restProps).reduce((acc, key) => {
    // Only include standard HTML attributes
    if (!['logoField', 'nameField', 'idField', 'entity', 'imageField', 'imageAltField', 
          'showImage', 'imagePlaceholderColor', 'titleField', 'subtitleField', 'showId',
          'showCreatedAt', 'dateField', 'dateFormat', 'renderHeader', 'renderDetails',
          'renderActions', 'renderFooter', 'onEdit', 'onDelete', 'onView', 'onToggleStatus',
          'loading', 'disabled', 'size', 'variant', 'showStatus', 'statusField',
          'statusLabels', 'statusColors'].includes(key)) {
      acc[key] = restProps[key];
    }
    return acc;
  }, {});

  // Render custom header if provided
  if (renderHeader) {
    return (
      <div className={cardClassName} {...domProps}>
        {renderHeader(entity)}
        {renderDetails && (
          <div className="entityCardBody appendBottom20">
            {renderDetails(entity)}
          </div>
        )}
        {renderActions && (
          <div className="entityCardActions">
            {renderActions(entity)}
          </div>
        )}
        {renderFooter && (
          <div className="entityCardFooter">
            {renderFooter(entity)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cardClassName} {...domProps}>
      {/* Card Header */}
      <div className="entityCardHeader makeFlex top gap10 appendBottom20">
        {showImage && (
          <div className="entityLogo">
            {entity[imageField] ? (
              <>
                <img
                  src={entity[imageField]}
                  alt={entity[imageAltField] || entity[titleField]}
                  className="entityLogoImage"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextSibling) {
                      e.target.nextSibling.style.display = 'block';
                    }
                  }}
                />
                {imagePlaceholderColor && (
                  <div 
                    className="entityLogoPlaceholder"
                    style={{ 
                      backgroundColor: imagePlaceholderColor,
                      display: 'none'
                    }}
                  >
                    {entity[titleField]?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
              </>
            ) : (
              // Always show placeholder when no image, if imagePlaceholderColor is provided
              imagePlaceholderColor && (
                <div 
                  className="entityLogoPlaceholder"
                  style={{ backgroundColor: imagePlaceholderColor }}
                >
                  {entity[titleField]?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )
            )}
          </div>
        )}
        
        <div className="entityInfo flexOne">
          <h3 className="entityName font20 fontBold blackText appendBottom4">
            {entity[titleField]}
          </h3>
          {subtitleField && entity[subtitleField] && (
            <p className="entitySubtitle font12 grayText appendBottom4">
              {entity[subtitleField]}
            </p>
          )}
          {showId && entity[idField] && (
            <p className="entityId font14 grayText appendBottom4">
              ID: {entity[idField]}
            </p>
          )}
          {showStatus && entity[statusField] !== undefined && (
            <span className={`entityStatus font14 ${statusColors[entity[statusField] ? 'active' : 'inactive']}`}>
              {entity[statusField] ? statusLabels.active : statusLabels.inactive}
            </span>
          )}
        </div>
      </div>
      
      {/* Custom details rendering */}
      {renderDetails && (
        <div className="entityCardBody appendBottom20">
          {renderDetails(entity)}
        </div>
      )}
      
      {/* Custom actions or default actions */}
      {renderActions ? (
        renderActions(entity)
      ) : (
        <div className="entityCardActions makeFlex gap10">
          {onView && (
            <button
              onClick={handleView}
              className="btnView flexOne"
              disabled={loading || disabled}
              title="View Details"
            >
              👁️ View
            </button>
          )}
          {onEdit && (
            <button
              onClick={handleEdit}
              className="btnEdit flexOne"
              disabled={loading || disabled}
              title="Edit"
            >
              ✏️ Edit
            </button>
          )}
          {onToggleStatus && (
            <button
              onClick={handleToggleStatus}
              className="btnToggleStatus flexOne"
              disabled={loading || disabled}
              title={entity[statusField] ? "Deactivate" : "Activate"}
            >
              {entity[statusField] ? "⏸️ Deactivate" : "▶️ Activate"}
            </button>
          )}
          {onDelete && (
            <button
              onClick={handleDelete}
              className="btnDelete flexOne"
              disabled={loading || disabled}
              title="Delete"
            >
              🗑️ Delete
            </button>
          )}
        </div>
      )}
      
      {/* Custom footer */}
      {renderFooter && (
        <div className="entityCardFooter">
          {renderFooter(entity)}
        </div>
      )}
    </div>
  );
};

export default EntityCard; 