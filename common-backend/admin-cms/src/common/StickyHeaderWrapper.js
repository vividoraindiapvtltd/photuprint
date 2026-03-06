import React, { useState, useEffect } from 'react';

const StickyHeaderWrapper = ({ children, className = "" }) => {
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const threshold = 100; // Start sticking after 100px scroll
      const newStickyState = scrollTop > threshold;
      
      setIsSticky(newStickyState);
      
      // Add/remove body class to prevent content jump
      if (newStickyState) {
        document.body.classList.add('pageHeaderStickyActive');
      } else {
        document.body.classList.remove('pageHeaderStickyActive');
      }
    };

    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.body.classList.remove('pageHeaderStickyActive');
    };
  }, []);

  return (
    <div className={`stickyHeaderWrapper ${isSticky ? 'stickyActive' : ''} ${className}`}>
      {children}
    </div>
  );
};

export default StickyHeaderWrapper; 