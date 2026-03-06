import React from 'react';

const FormContainer = ({
  // Form configuration
  onSubmit = null,
  method = 'post',
  action = null,
  encType = null,
  
  // Layout
  layout = 'vertical', // 'vertical', 'horizontal', 'grid', 'compact'
  columns = 1, // Number of columns for grid layout
  gap = 'normal', // 'small', 'normal', 'large'
  
  // Styling
  className = '',
  variant = 'default', // 'default', 'card', 'bordered', 'minimal'
  size = 'normal', // 'small', 'normal', 'large'
  
  // Sections
  sections = [],
  showSectionDividers = true,
  
  // Actions
  actions = null,
  showActions = true,
  actionsPosition = 'bottom', // 'top', 'bottom', 'both'
  actionsAlignment = 'left', // 'left', 'center', 'right', 'space-between'
  
  // Validation
  showValidationSummary = false,
  validationErrors = [],
  validationWarnings = [],
  
  // State
  loading = false,
  disabled = false,
  
  // Children
  children,
  
  // Additional props
  ...props
}) => {
  
  // Layout-based classes
  const layoutClasses = {
    vertical: 'formContainerVertical',
    horizontal: 'formContainerHorizontal',
    grid: 'formContainerGrid',
    compact: 'formContainerCompact'
  };

  // Variant-based classes
  const variantClasses = {
    default: 'formContainerDefault',
    card: 'formContainerCard',
    bordered: 'formContainerBordered',
    minimal: 'formContainerMinimal'
  };

  // Size-based classes
  const sizeClasses = {
    small: 'formContainerSmall',
    normal: 'formContainerNormal',
    large: 'formContainerLarge'
  };

  // Gap-based classes
  const gapClasses = {
    small: 'formContainerGapSmall',
    normal: 'formContainerGapNormal',
    large: 'formContainerGapLarge'
  };

  const containerClassName = `formContainer ${layoutClasses[layout]} ${variantClasses[variant]} ${sizeClasses[size]} ${gapClasses[gap]} ${className}`;
  
  // Grid layout styles
  const gridStyles = layout === 'grid' ? {
    gridTemplateColumns: `repeat(${columns}, 1fr)`
  } : {};
  
  // Handle form submission
  const handleSubmit = (e) => {
    if (onSubmit) {
      onSubmit(e);
    }
  };
  
  // Render validation summary
  const renderValidationSummary = () => {
    if (!showValidationSummary || (!validationErrors.length && !validationWarnings.length)) {
      return null;
    }
    
    return (
      <div className="formValidationSummary">
        {validationErrors.length > 0 && (
          <div className="formValidationErrors">
            <div className="validationErrorHeader">
              <span className="validationErrorIcon">❌</span>
              <span className="validationErrorTitle">Please fix the following errors:</span>
            </div>
            <div className="validationErrorList">
              {validationErrors.map((error, index) => (
                <div key={index} className="validationErrorItem">
                  <span className="validationErrorBullet">•</span>
                  <span className="validationErrorText">{error}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {validationWarnings.length > 0 && (
          <div className="formValidationWarnings">
            <div className="validationWarningHeader">
              <span className="validationWarningIcon">⚠️</span>
              <span className="validationWarningTitle">Please note the following warnings:</span>
            </div>
            <div className="validationWarningList">
              {validationWarnings.map((warning, index) => (
                <div key={index} className="validationWarningItem">
                  <span className="validationWarningBullet">•</span>
                  <span className="validationWarningText">{warning}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  // Render actions
  const renderActions = (position) => {
    if (!showActions || !actions || actionsPosition !== position) return null;
    
    const actionsClassName = `formActions formActions${position.charAt(0).toUpperCase() + position.slice(1)} formActions${actionsAlignment.charAt(0).toUpperCase() + actionsAlignment.slice(1)}`;
    
    return (
      <div className={actionsClassName}>
        {Array.isArray(actions) ? actions.map((action, index) => (
          <div key={index} className="formAction">
            {action}
          </div>
        )) : actions}
      </div>
    );
  };
  
  // Render sections
  const renderSections = () => {
    if (!sections || sections.length === 0) return children;
    
    return sections.map((section, index) => (
      <div key={index} className="formSection">
        {section.title && (
          <div className="formSectionHeader">
            <h3 className="formSectionTitle">{section.title}</h3>
            {section.description && (
              <p className="formSectionDescription">{section.description}</p>
            )}
          </div>
        )}
        
        <div className="formSectionContent">
          {section.content}
        </div>
        
        {showSectionDividers && index < sections.length - 1 && (
          <div className="formSectionDivider" />
        )}
      </div>
    ));
  };
  
  // Form element
  const FormElement = onSubmit ? 'form' : 'div';
  const formProps = onSubmit ? {
    onSubmit: handleSubmit,
    method,
    action,
    encType
  } : {};
  
  return (
    <FormElement className={containerClassName} style={gridStyles} {...formProps} {...props}>
      {/* Top Actions */}
      {renderActions('top')}
      
      {/* Validation Summary */}
      {renderValidationSummary()}
      
      {/* Form Content */}
      <div className="formContent">
        {renderSections()}
      </div>
      
      {/* Bottom Actions */}
      {renderActions('bottom')}
    </FormElement>
  );
};

export default FormContainer; 