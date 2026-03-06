import React from 'react';

const EntityCardHeader = ({ 
  entity,
  imageField = 'logo',
  titleField = 'name',
  dateField = 'createdAt',
  imagePlaceholderColor = null,
  generateColor = null,
  title = null,
  subtitle = null,
  onImageClick = null
}) => {
  const displayTitle = title || entity[titleField];
  const displaySubtitle = subtitle;
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      const dateStr = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      return `${dateStr} : ${timeStr}`;
    } catch (error) {
      return 'N/A';
    }
  };

  const getPlaceholderColor = () => {
    if (imagePlaceholderColor) return imagePlaceholderColor;
    if (generateColor) return generateColor(entity._id, entity[titleField]);
    return '#e5e7eb'; // default gray
  };

  return (
    <div className="entityCardHeader makeFlex top gap10 appendBottom20">
      <div className="entityLogo">
        {entity[imageField] ? (
          <>
            <img
              src={entity[imageField]}
              alt={displayTitle}
              className="entityLogoImage"
              style={onImageClick ? { cursor: 'pointer' } : {}}
              onClick={onImageClick ? () => onImageClick(entity[imageField]) : undefined}
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextSibling) {
                  e.target.nextSibling.style.display = 'block';
                }
              }}
            />
            <div 
              className="entityLogoPlaceholder"
              style={{ 
                backgroundColor: getPlaceholderColor(),
                display: 'none'
              }}
            >
              {displayTitle?.charAt(0)?.toUpperCase() || '?'}
            </div>
          </>
        ) : (
          <div 
            className="entityLogoPlaceholder"
            style={{ backgroundColor: getPlaceholderColor() }}
          >
            {displayTitle?.charAt(0)?.toUpperCase() || '?'}
          </div>
        )}
      </div>
      
      <div className="entityInfo flexOne">
        <h3 className="entityName font20 fontBold blackText appendBottom4">
          {displayTitle}
        </h3>
        {displaySubtitle && (
          <p className="entitySubtitle font14 grayText appendBottom4">
            {displaySubtitle}
          </p>
        )}
        <p className="entityId font12 grayText appendBottom4">
          Created at: {formatDate(entity[dateField])}
        </p>
      </div>
    </div>
  );
};

export default EntityCardHeader; 