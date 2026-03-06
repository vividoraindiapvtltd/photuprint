import React, { useState, useRef, useEffect } from 'react';

/**
 * SearchableSelect Component
 * A searchable dropdown that filters options as you type
 */
const SearchableSelect = ({
  name,
  label,
  value,
  onChange,
  options = [],
  placeholder = "Type to search...",
  required = false,
  disabled = false,
  className = "",
  info = null,
  error = null,
  warning = null,
  onBlur = null,
  onFocus = null
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredOptions, setFilteredOptions] = useState(options);
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Get selected option label
  const selectedOption = options.find(opt => opt.value === value);
  const displayValue = selectedOption ? selectedOption.label : "";

  // Filter options based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredOptions(options);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = options.filter(option =>
        option.label.toLowerCase().includes(query)
      );
      setFilteredOptions(filtered);
    }
  }, [searchQuery, options]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle input change
  const handleInputChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    setIsOpen(true);
    
    // If query matches an option exactly, select it
    const exactMatch = options.find(
      opt => opt.label.toLowerCase() === query.toLowerCase()
    );
    if (exactMatch) {
      handleSelect(exactMatch.value);
    }
  };

  // Handle option selection
  const handleSelect = (selectedValue) => {
    const syntheticEvent = {
      target: {
        name: name,
        value: selectedValue
      }
    };
    onChange(syntheticEvent);
    setSearchQuery("");
    setIsOpen(false);
  };

  // Handle input focus
  const handleInputFocus = () => {
    setIsOpen(true);
    setIsFocused(true);
    if (onFocus) onFocus();
  };

  // Handle input blur
  const handleInputBlur = () => {
    // Delay to allow option click
    setTimeout(() => {
      setIsOpen(false);
      setSearchQuery("");
      setIsFocused(false);
      if (onBlur) onBlur();
    }, 200);
  };

  // Handle clear selection
  const handleClear = (e) => {
    e.stopPropagation();
    const syntheticEvent = {
      target: {
        name: name,
        value: ""
      }
    };
    onChange(syntheticEvent);
    setSearchQuery("");
    setIsOpen(false);
  };

  return (
    <div className={`searchableSelectWrapper ${className}`} ref={wrapperRef}>
      {label && (
        <label className="formLabel">
          {label} {required && <span className="required">*</span>}
        </label>
      )}
      
      <div className="searchableSelectContainer" style={{ position: "relative" }}>
        <div className="searchableSelectInputWrapper">
          <input
            ref={inputRef}
            type="text"
            className="searchableSelectInput"
            value={isOpen ? searchQuery : displayValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            style={{
              width: "100%",
              padding: "12px 40px 12px 16px",
              border: error ? "2px solid #dc3545" : (isFocused || isOpen) ? "2px solid #667eea" : "2px solid #e5e7eb",
              borderRadius: "8px",
              fontSize: "1rem",
              background: disabled ? "#f3f4f6" : (isFocused || isOpen) ? "white" : "#f9fafb",
              outline: "none",
              transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              boxSizing: "border-box",
              boxShadow: (isFocused || isOpen) && !error ? "0 0 0 4px rgba(102, 126, 234, 0.15)" : "none"
            }}
          />
          <div className="searchableSelectIcons" style={{
            position: "absolute",
            right: "8px",
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
            gap: "4px"
          }}>
            {value && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px",
                  fontSize: "16px",
                  color: "#666",
                  display: "flex",
                  alignItems: "center"
                }}
                title="Clear selection"
              >
                ✕
              </button>
            )}
            <span
              className="searchableSelectArrow"
              style={{
                width: "16px",
                height: "16px",
                display: "inline-block",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                backgroundSize: "16px",
                transform: isOpen ? "rotate(180deg)" : "none",
                transition: "transform 0.2s ease",
              }}
            />
          </div>
        </div>

        {isOpen && (
          <div className="searchableSelectDropdown" style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            backgroundColor: "#fff",
            border: "1px solid #ced4da",
            borderTop: "none",
            borderRadius: "0 0 4px 4px",
            maxHeight: "200px",
            overflowY: "auto",
            zIndex: 1000,
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)"
          }}>
            {filteredOptions.length === 0 ? (
              <div style={{
                padding: "12px",
                textAlign: "center",
                color: "#666",
                fontSize: "14px"
              }}>
                No options found
              </div>
            ) : (
              filteredOptions.map((option, index) => (
                <div
                  key={index}
                  onClick={() => handleSelect(option.value)}
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    backgroundColor: value === option.value ? "#e7f3ff" : "#fff",
                    borderBottom: index < filteredOptions.length - 1 ? "1px solid #f0f0f0" : "none",
                    fontSize: "14px",
                    transition: "background-color 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    if (value !== option.value) {
                      e.target.style.backgroundColor = "#f8f9fa";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (value !== option.value) {
                      e.target.style.backgroundColor = "#fff";
                    }
                  }}
                >
                  {option.label}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Info, Warning, Error messages */}
      {info && !error && !warning && (
        <div className="formInfo" style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
          {info}
        </div>
      )}
      
      {warning && (
        <div className="formWarning" style={{ fontSize: "12px", color: "#ffc107", marginTop: "4px" }}>
          ⚠️ {warning}
        </div>
      )}
      
      {error && (
        <div className="formError" style={{ fontSize: "12px", color: "#dc3545", marginTop: "4px" }}>
          ❌ {error}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
