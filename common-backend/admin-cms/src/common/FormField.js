import React, { forwardRef } from 'react';

const FormField = forwardRef(({ 
  type = 'text',
  name,
  label,
  value,
  onChange,
  onBlur = null,
  onFocus = null,
  placeholder = '',
  required = false,
  disabled = false,
  className = '',
  info = null,
  error = null,
  warning = null,
  
  // Text input specific
  rows = 3,
  maxLength = null,
  minLength = null,
  pattern = null,
  
  // File input specific
  accept = null,
  multiple = false,
  
  // Number input specific
  min = null,
  max = null,
  step = null,
  
  // Select specific
  options = [],
  placeholderOption = null,
  
  // Checkbox/Radio specific
  checked = null,
  
  // Text transformation
  uppercase = false,
  alphanumeric = false,
  numeric = false,
  email = false,
  
  // Layout
  fullWidth = false,
  inline = false,
  labelPosition = 'top', // 'top', 'left', 'right'
  
  // Additional props (filter out inputRef to avoid React warning)
  inputRef,
  ...props
}, ref) => {
  const fieldId = `field-${name}`;
  
  const handleChange = (e) => {
    const originalValue = e.target.value;
    let newValue = originalValue;
    
    // Handle text transformations
    if (uppercase && type === 'text') {
      newValue = newValue.toUpperCase();
    }
    
    if (alphanumeric && type === 'text') {
      newValue = newValue.replace(/[^A-Za-z0-9]/g, '');
    }
    
    if (numeric && type === 'text') {
      newValue = newValue.replace(/[^0-9]/g, '');
    }
    
    // Only create modified event if value actually changed
    if (newValue !== originalValue) {
      const syntheticEvent = {
        target: {
          name: e.target.name,
          value: newValue,
          type: e.target.type,
          files: e.target.files || null,
          checked: e.target.checked || false
        }
      };
      onChange(syntheticEvent);
    } else {
      onChange(e);
    }
  };

  const handleBlur = (e) => {
    if (onBlur) onBlur(e);
  };

  const handleFocus = (e) => {
    if (onFocus) onFocus(e);
  };
  
  const renderInput = () => {
    switch (type) {
      case 'textarea':
        return (
          <textarea
            ref={ref || inputRef}
            id={fieldId}
            name={name}
            value={value || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
            className={`formTextarea ${className}`}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            rows={rows}
            maxLength={maxLength}
            minLength={minLength}
            pattern={pattern}
            {...props}
          />
        );
      
      case 'file':
        return (
          <>
            <input
              ref={ref || inputRef}
              type="file"
              id={fieldId}
              name={name}
              onChange={onChange}
              onBlur={handleBlur}
              onFocus={handleFocus}
              className={`formFileInput ${className}`}
              accept={accept}
              multiple={multiple}
              disabled={disabled}
              required={required}
              {...props}
            />
            {info && (
              <div className="fileInputInfo">
                {info}
              </div>
            )}
          </>
        );
      
      case 'number':
        return (
          <input
            type="number"
            id={fieldId}
            name={name}
            value={value !== undefined && value !== null ? value : ''}
            onChange={handleChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
            className={`formInput ${className}`}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            min={min}
            max={max}
            step={step}
            {...props}
          />
        );
      
      case 'select':
        return (
          <select
            ref={ref || inputRef}
            id={fieldId}
            name={name}
            value={value || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
            className={`formSelect ${className}`}
            required={required}
            disabled={disabled}
            {...props}
          >
            {placeholderOption && (
              <option value="" disabled>
                {placeholderOption}
              </option>
            )}
            {options.map((option, index) => (
              <option key={index} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      
      case 'checkbox':
        return (
          <input
            type="checkbox"
            id={fieldId}
            name={name}
            checked={checked !== null ? checked : value}
            onChange={onChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
            className={`formCheckbox ${className}`}
            disabled={disabled}
            required={required}
            {...props}
          />
        );

      case 'radio':
        return (
          <input
            type="radio"
            id={fieldId}
            name={name}
            value={value}
            checked={checked !== null ? checked : value}
            onChange={onChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
            className={`formRadio ${className}`}
            disabled={disabled}
            required={required}
            {...props}
          />
        );

      case 'email':
        return (
          <input
            type="email"
            id={fieldId}
            name={name}
            value={value || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
            className={`formInput ${className}`}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            maxLength={maxLength}
            pattern={pattern}
            {...props}
          />
        );

      case 'password':
        return (
          <input
            type="password"
            id={fieldId}
            name={name}
            value={value || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
            className={`formInput ${className}`}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            maxLength={maxLength}
            minLength={minLength}
            pattern={pattern}
            {...props}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            id={fieldId}
            name={name}
            value={value || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
            className={`formInput ${className}`}
            required={required}
            disabled={disabled}
            min={min}
            max={max}
            {...props}
          />
        );

      case 'time':
        return (
          <input
            type="time"
            id={fieldId}
            name={name}
            value={value || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
            className={`formInput ${className}`}
            required={required}
            disabled={disabled}
            min={min}
            max={max}
            step={step}
            {...props}
          />
        );

      case 'datetime-local':
        return (
          <input
            type="datetime-local"
            id={fieldId}
            name={name}
            value={value || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
            className={`formInput ${className}`}
            required={required}
            disabled={disabled}
            min={min}
            max={max}
            step={step}
            {...props}
          />
        );
      
      default:
        return (
          <input
            type={type}
            id={fieldId}
            name={name}
            value={value || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
            className={`formInput ${className}`}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            maxLength={maxLength}
            minLength={minLength}
            pattern={pattern}
            {...props}
          />
        );
    }
  };

  // Layout classes
  const layoutClasses = [
    'formField',
    fullWidth && 'formFieldFullWidth',
    inline && 'formFieldInline',
    `formFieldLabel${labelPosition.charAt(0).toUpperCase() + labelPosition.slice(1)}`
  ].filter(Boolean).join(' ');

  return (
    <div className={layoutClasses}>
      {label && (
        <label htmlFor={fieldId} className="formLabel">
          {label} {required && <span className="required">*</span>}
        </label>
      )}
      
      {renderInput()}
      
      {/* Info, Warning, Error messages */}
      {info && type !== 'file' && !error && !warning && (
        <div className="formInfo">
          {info}
        </div>
      )}
      
      {warning && (
        <div className="formWarning">
          ⚠️ {warning}
        </div>
      )}
      
      {error && (
        <div className="formError">
          ❌ {error}
        </div>
      )}
      
      {/* Character count for text inputs */}
      {maxLength && type !== 'file' && value && (
        <div className="formCharCount">
          <span className={
            value.length === maxLength ? 'charCountComplete' : 
            value.length > maxLength ? 'charCountExceeded' : 
            'charCountNormal'
          }>
            {value.length}/{maxLength}
          </span>
        </div>
      )}
    </div>
  );
});

export default FormField; 