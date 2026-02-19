import React, { useState, useEffect } from "react";

const Footer: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    checkDarkMode();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          checkDarkMode();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);

  const currentYear = new Date().getFullYear();

  // Theme-aware colors
  const bgColor = isDarkMode ? '#1e293b' : '#f9fafb';
  const borderColor = isDarkMode ? '#334155' : '#e5e7eb';
  const textColor = isDarkMode ? '#ffffff' : '#1f2937';
  const textSecondary = isDarkMode ? '#9ca3af' : '#6b7280';

  return (
    <footer 
      className="px-6 py-4 transition-colors duration-300"
      style={{ backgroundColor: bgColor, borderColor: borderColor, borderTopWidth: '1px', borderTopStyle: 'solid' }}
    >
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span style={{ color: textSecondary }}>©</span>
          <span style={{ color: textColor, fontWeight: 500 }}>Dashboard Inc.</span>
          <span style={{ color: textSecondary }}>|</span>
          <span style={{ color: textSecondary }}>All rights reserved</span>
        </div>
        <div className="flex items-center gap-4" style={{ color: textSecondary }}>
          <span>Version 1.0.0</span>
          <span>|</span>
          <span>{currentYear}</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
