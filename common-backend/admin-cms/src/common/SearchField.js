import React from 'react';

const SearchField = ({ 
  value, 
  onChange, 
  placeholder = "Search...", 
  disabled = false,
  className = "",
  minWidth = "200px",
  clearable = true,
  onClear,
  searchIcon = true
}) => {
  const handleClear = () => {
    if (onClear) {
      onClear();
    } else if (onChange) {
      // Create a synthetic event to clear the search
      const syntheticEvent = {
        target: {
          value: "",
          name: "search"
        }
      };
      onChange(syntheticEvent);
    }
  };

  return (
    <div className={`searchContainer ${className}`}>
      {searchIcon && (
        <div className="searchIcon">
          🔍
        </div>
      )}
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="searchInput"
        disabled={disabled}
        style={{ minWidth }}
      />
      {clearable && value && (
        <button
          onClick={handleClear}
          className="clearSearchBtn"
          title="Clear search"
          type="button"
        >
          ✕
        </button>
      )}
    </div>
  );
};

export default SearchField; 