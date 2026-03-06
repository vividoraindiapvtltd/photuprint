import React from 'react';

const ViewToggle = ({ 
  viewMode, 
  onViewChange, 
  disabled = false,
  cardText = "Cards",
  listText = "List",
  className = "" 
}) => {
  return (
    <div className={`viewToggleContainer ${className}`}>
      <button
        onClick={() => onViewChange('card')}
        className={`viewToggleBtn ${viewMode === 'card' ? 'active' : ''}`}
        disabled={disabled}
      >
        <span className="viewIcon">⊞</span>
        <span className="viewText">{cardText}</span>
      </button>
      <button
        onClick={() => onViewChange('list')}
        className={`viewToggleBtn ${viewMode === 'list' ? 'active' : ''}`}
        disabled={disabled}
      >
        <span className="viewIcon">☰</span>
        <span className="viewText">{listText}</span>
      </button>
    </div>
  );
};

export default ViewToggle; 