import React, { useState, useEffect } from 'react';
import '../css/styles.css';

const ValidationErrorPopup = ({
  isVisible,
  errors,
  onClose,
  autoClose = true,
  autoCloseDelay = 5000
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      
      if (autoClose) {
        const timer = setTimeout(() => {
          setIsAnimating(false);
          setTimeout(() => {
            onClose();
          }, 300); // Wait for slide-out animation
        }, autoCloseDelay);
        
        return () => clearTimeout(timer);
      }
    }
  }, [isVisible, autoClose, autoCloseDelay, onClose]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300); // Wait for slide-out animation
  };

  if (!isVisible) return null;

  return (
    <div className="validationErrorPopupOverlay">
      <div className={`validationErrorPopup ${isAnimating ? 'slideIn' : 'slideOut'}`}>
        <div className="validationErrorPopupHeader">
          <div className="validationErrorPopupTitle">
            <span className="validationErrorPopupIcon">⚠️</span>
            <span>Validation Errors</span>
          </div>
          <button
            type="button"
            className="validationErrorPopupCloseBtn"
            onClick={handleClose}
          >
            ✕
          </button>
        </div>
        
        <div className="validationErrorPopupBody">
          <p className="validationErrorPopupMessage">
            Please fix the following errors before submitting:
          </p>
          <div className="validationErrorPopupList">
            {errors.map((error, index) => (
              <div key={index} className="validationErrorPopupItem">
                <span className="validationErrorPopupBullet">•</span>
                <span className="validationErrorPopupText">{error}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="validationErrorPopupActions">
          <button
            type="button"
            className="btnPrimary validationErrorPopupBtn"
            onClick={handleClose}
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};

export default ValidationErrorPopup; 