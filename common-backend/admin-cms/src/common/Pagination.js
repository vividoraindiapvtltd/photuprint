import React, { useState } from 'react';

const Pagination = ({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  disabled = false,
  showGoToPage = true,
  className = "" 
}) => {
  const [pageInput, setPageInput] = useState('');

  const handleGoToPage = (e) => {
    e.preventDefault();
    const pageNumber = parseInt(pageInput);
    
    if (pageNumber && pageNumber >= 1 && pageNumber <= totalPages) {
      onPageChange(pageNumber);
      setPageInput('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (totalPages <= 1) return null;

  return (
    <div className={`paginationContainer textCenter paddingAll20 ${className}`}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        className="btnSecondary"
        disabled={disabled || currentPage === 1}
      >
        Previous
      </button>
      
      <span className="pageNumber">Page {currentPage} of {totalPages}</span>
      
      {showGoToPage && (
        <div className="goToPageContainer">
          <span className="goToPageLabel">Go to:</span>
          <input
            type="number"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            className="pageInput"
            placeholder="Page #"
            min="1"
            max={totalPages}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleGoToPage(e);
              }
            }}
          />
          <button
            onClick={handleGoToPage}
            className="btnGo"
            disabled={disabled}
          >
            Go
          </button>
        </div>
      )}
      
      <button
        onClick={() => onPageChange(currentPage + 1)}
        className="btnSecondary"
        disabled={disabled || currentPage === totalPages}
      >
        Next
      </button>
    </div>
  );
};

export default Pagination; 