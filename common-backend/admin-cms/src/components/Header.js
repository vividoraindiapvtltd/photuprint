import React from 'react';
import { useAuth } from '../context/AuthContext';
import { MdLogout } from "react-icons/md";

// Helper function to generate color from string
const generateColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
};

// Helper function to normalize image URL
const normalizeImageUrl = (imageUrl) => {
  if (!imageUrl) return null;
  
  // If it's already a full URL, return as is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // Handle relative paths
  if (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('/')) {
    return `${imageUrl}`;
  }
  
  // Relative path without leading slash
  return `/uploads/${imageUrl}`;
};

const Header = () => {
    const { user, logout, selectedWebsite } = useAuth();
    
    // Get website logo URL
    const websiteLogoUrl = selectedWebsite?.logo ? normalizeImageUrl(selectedWebsite.logo) : null;
    const websiteName = selectedWebsite?.name || null;
    const websiteInitial = websiteName ? websiteName.charAt(0).toUpperCase() : '?';
    const websiteColor = websiteName ? generateColor(websiteName) : '#e5e7eb';
    
    return(
        <div className="headerWrapper">
            <div className="makeFlex alignCenter spaceBetween" style={{ width: '100%' }}>
                <div className="makeFlex alignCenter gap16">
                    {/* Website Logo and Name */}
                    {selectedWebsite && (
                        <div className="makeFlex alignCenter gap10 paddingRight16 borderRight1px">
                            {websiteLogoUrl ? (
                                <img
                                    src={websiteLogoUrl}
                                    alt={websiteName}
                                    style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '8px',
                                        objectFit: 'cover',
                                        border: '2px solid #e5e7eb'
                                    }}
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        if (e.target.nextSibling) {
                                            e.target.nextSibling.style.display = 'flex';
                                        }
                                    }}
                                />
                            ) : null}
                            <div
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '8px',
                                    backgroundColor: websiteColor,
                                    color: 'white',
                                    display: websiteLogoUrl ? 'none' : 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                    border: '2px solid #e5e7eb'
                                }}
                            >
                                {websiteInitial}
                            </div>
                            <div>
                                <h3 className="font14 fontBold blackText" style={{ margin: 0, lineHeight: '1.2' }}>
                                    {websiteName}
                                </h3>
                                <p className="font12 grayText" style={{ margin: 0, lineHeight: '1.2' }}>
                                    {selectedWebsite.domain}
                                </p>
                            </div>
                        </div>
                    )}
                    
                    {/* Welcome Message */}
                    <h2 className="font16 blackText fontMedium appendRight10 paddingRight10 borderRight1px">
                        Welcome, <span className="fontBold">{user?.user?.name || 'Admin'}!</span> 👋
                    </h2>
                </div>
                
                {/* Logout Button */}
                <button onClick={logout} className="logoutButtonStyle">
                    <span className="makeFlex alignCenter">
                        <MdLogout size={18} />&nbsp;Logout
                    </span>
                </button>
            </div>
      </div>
    )
}

export default Header;