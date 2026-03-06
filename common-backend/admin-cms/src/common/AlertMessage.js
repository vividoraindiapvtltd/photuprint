import React, { useState, useEffect, useCallback, useRef } from 'react';

const AlertMessage = ({ 
  type = 'success', // 'success' or 'error'
  message, 
  onClose, 
  autoClose = true,
  autoCloseDelay = 5000,
  className = "" 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldHide, setShouldHide] = useState(false);

  // Track previous message to detect changes
  const prevMessageRef = useRef(message);
  const onCloseRef = useRef(onClose);
  const timerRef = useRef(null);
  const isVisibleRef = useRef(false);

  // Update refs when props change
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleClose = useCallback(() => {
    if (!isVisibleRef.current) return; // Already closed
    
    console.log('handleClose called - starting slide out animation');
    setShouldHide(true);
    
    // Wait for slide out animation to complete (300ms)
    setTimeout(() => {
      console.log('Slide out animation completed - hiding popup');
      setIsVisible(false);
      setShouldHide(false);
      isVisibleRef.current = false;
      // Only call onClose when the popup is actually closing
      if (onCloseRef.current) {
        console.log('Calling onClose callback');
        onCloseRef.current();
      }
    }, 300); // Wait for slide out animation
  }, []); // No dependencies - uses refs

  useEffect(() => {
    // Check if message actually changed
    const messageChanged = prevMessageRef.current !== message;
    const hasMessage = message && message.trim();
    const hadMessage = prevMessageRef.current && prevMessageRef.current.trim();
    
    // Update ref
    prevMessageRef.current = message;
    
    console.log('AlertMessage useEffect - message:', message, 'type:', type, 'changed:', messageChanged, 'hasMessage:', hasMessage);
    
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    if (hasMessage) {
      // Show message if it changed OR if we're not currently visible (initial mount or after being hidden)
      if (messageChanged || !isVisibleRef.current) {
        console.log('Setting popup visible with slide in animation');
        setIsVisible(true);
        setShouldHide(false);
        isVisibleRef.current = true;
        
        // Auto close after delay
        if (autoClose) {
          console.log('Setting auto-close timer for', autoCloseDelay, 'ms');
          timerRef.current = setTimeout(() => {
            console.log('Auto-close timer fired - starting slide out animation');
            setShouldHide(true);
            setTimeout(() => {
              setIsVisible(false);
              setShouldHide(false);
              isVisibleRef.current = false;
              if (onCloseRef.current) {
                onCloseRef.current();
              }
            }, 300);
          }, autoCloseDelay);
        }
      }
    } else if (messageChanged && hadMessage && isVisibleRef.current) {
      // Message became empty - hide the popup immediately
      console.log('Message became empty, hiding popup');
      setIsVisible(false);
      setShouldHide(false);
      isVisibleRef.current = false;
    }
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [message, autoClose, autoCloseDelay]); // Removed handleClose completely

  console.log('AlertMessage render - message:', message, 'isVisible:', isVisible, 'shouldHide:', shouldHide);

  if (!message || !message.trim() || !isVisible) {
    console.log('AlertMessage not rendering - message:', message, 'isVisible:', isVisible);
    return null;
  }

  const alertClasses = type === 'success' ? 'alertMessageSuccess' : 'alertMessageError';
  const icon = type === 'success' ? '✓' : '✕';
  const title = type === 'success' ? 'Success!' : 'Error!';

  console.log('AlertMessage rendering popup with animation class:', shouldHide ? 'slideOut' : 'slideIn');

  return (
    <div className="alertMessageOverlay">
      <div className={`alertMessageBox ${alertClasses} ${className} ${shouldHide ? 'slideOut' : 'slideIn'}`}>
        <div className="alertMessageHeader">
          <div className="alertMessageIcon">
            {icon}
          </div>
          <div className="alertMessageTitle">
            {title}
          </div>
          <button 
            onClick={handleClose} 
            className="alertMessageCloseBtn"
            aria-label="Close alert"
          >
            ×
          </button>
        </div>
        <div className="alertMessageContent">
          {message}
        </div>
      </div>
    </div>
  );
};

export default AlertMessage; 