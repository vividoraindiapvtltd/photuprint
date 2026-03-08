import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import '../css/styles.css';

const ShippingLabelPopup = ({ isVisible, order, onClose, onPrint }) => {
  const [company, setCompany] = useState(null);

  // Helper function to normalize logo URL
  const normalizeLogoUrl = (logoUrl) => {
    if (!logoUrl) return null;
    
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      if (logoUrl.includes('/backend/uploads/') || logoUrl.includes('/Users/')) {
        const filename = logoUrl.split('/').pop();
        return `/uploads/${filename}`;
      }
      return logoUrl;
    }
    
    if (logoUrl.includes('/backend/uploads/') || logoUrl.includes('/Users/')) {
      const filename = logoUrl.split('/').pop();
      return `/uploads/${filename}`;
    }
    
    if (logoUrl.startsWith('/uploads/') || logoUrl.startsWith('/')) {
      return `${logoUrl}`;
    }
    
    return `/uploads/${logoUrl}`;
  };

  useEffect(() => {
    if (isVisible && order) {
      // Fetch company data based on order's website
      const fetchCompany = async () => {
        try {
          let url = '/companies/default';
          // If order has a website, fetch company for that website
          if (order.website) {
            const websiteId = order.website._id || order.website;
            url = `/companies/default?websiteId=${websiteId}`;
          } else if (order.website?.domain) {
            // If website is populated with domain
            url = `/companies/default?domain=${order.website.domain}`;
          }
          
          const response = await api.get(url);
          const companyData = response.data;
          // Normalize logo URL
          if (companyData.logo) {
            companyData.logo = normalizeLogoUrl(companyData.logo);
          }
          setCompany(companyData);
        } catch (error) {
          console.error('Error fetching company data:', error);
          setCompany(null);
        }
      };
      fetchCompany();
    }
  }, [isVisible, order]);

  if (!isVisible || !order) return null;

  const handlePrint = () => {
    window.print();
    if (onPrint) onPrint();
  };

  const shippingAddress = order.shippingAddress || {};
  const customer = order.user || {};

  // Company info with fallback
  const companyName = company?.name || 'PhotuPrint';
  const companyAddress = company?.address 
    ? [
        company.address.street,
        company.address.city,
        company.address.state,
        company.address.zipCode,
        company.address.country
      ].filter(Boolean).join(', ')
    : 'Your Company Address';
  const companyPhone = company?.phone || '+91 1234567890';

  return (
    <div className="shippingLabelPopupOverlay" onClick={onClose}>
      <div className="shippingLabelPopup" onClick={(e) => e.stopPropagation()}>
        <div className="shippingLabelPopupHeader">
          <h2 className="shippingLabelPopupTitle">Shipping Label - Order #{order.orderNumber}</h2>
          <button className="shippingLabelPopupClose" onClick={onClose}>✕</button>
        </div>
        
        <div className="shippingLabelPopupBody" id="shipping-label-content">
          {/* Shipping Label Content */}
          <div className="shippingLabelContent">
            {/* Return Address */}
            <div className="shippingLabelReturnAddress">
              <div className="shippingLabelReturnAddressHeader">
                <strong>FROM:</strong>
              </div>
              <div className="shippingLabelReturnAddressBody">
                {company?.logo && (
                  <img 
                    src={company.logo} 
                    alt={companyName}
                    style={{ maxHeight: '40px', marginBottom: '8px', objectFit: 'contain' }}
                    onError={(e) => {
                      console.error('Company logo failed to load:', company.logo);
                      e.target.style.display = 'none';
                    }}
                  />
                )}
                <p><strong>{companyName}</strong></p>
                {company?.address && (
                  <>
                    {company.address.street && <p>{company.address.street}</p>}
                    {(company.address.city || company.address.state || company.address.zipCode) && (
                      <p>
                        {[company.address.city, company.address.state, company.address.zipCode].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {company.address.country && <p>{company.address.country}</p>}
                  </>
                )}
                {!company?.address && <p>{companyAddress}</p>}
                {companyPhone && <p>Phone: {companyPhone}</p>}
              </div>
            </div>

            {/* Shipping Address */}
            <div className="shippingLabelShippingAddress">
              <div className="shippingLabelShippingAddressHeader">
                <strong>SHIP TO:</strong>
              </div>
              <div className="shippingLabelShippingAddressBody">
                <p><strong>{shippingAddress.name || customer.name || 'N/A'}</strong></p>
                {shippingAddress.street && <p>{shippingAddress.street}</p>}
                {shippingAddress.city && shippingAddress.state && (
                  <p>{shippingAddress.city}, {shippingAddress.state} {shippingAddress.zipCode || ''}</p>
                )}
                {shippingAddress.country && <p>{shippingAddress.country}</p>}
                {shippingAddress.phone && <p>Phone: {shippingAddress.phone}</p>}
                {customer.email && <p>Email: {customer.email}</p>}
              </div>
            </div>

            {/* Shipping Details */}
            <div className="shippingLabelDetails">
              <div className="shippingLabelDetailRow">
                <span><strong>Order Number:</strong></span>
                <span>{order.orderNumber}</span>
              </div>
              <div className="shippingLabelDetailRow">
                <span><strong>Order Date:</strong></span>
                <span>{new Date(order.createdAt).toLocaleDateString()}</span>
              </div>
              {/* Courier Tracking Details */}
              {order.courierName && (
                <div className="shippingLabelDetailRow">
                  <span><strong>Courier:</strong></span>
                  <span>{order.courierName}{order.courierServiceType ? ` - ${order.courierServiceType}` : ''}</span>
                </div>
              )}
              {order.trackingNumber && (
                <div className="shippingLabelDetailRow">
                  <span><strong>Tracking Number:</strong></span>
                  <span className="trackingNumber">
                    {order.trackingUrl ? (
                      <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc', textDecoration: 'underline' }}>
                        {order.trackingNumber}
                      </a>
                    ) : (
                      order.trackingNumber
                    )}
                  </span>
                </div>
              )}
              {order.shipmentDate && (
                <div className="shippingLabelDetailRow">
                  <span><strong>Shipment Date:</strong></span>
                  <span>{new Date(order.shipmentDate).toLocaleDateString()}</span>
                </div>
              )}
              {order.estimatedDeliveryDate && (
                <div className="shippingLabelDetailRow">
                  <span><strong>Estimated Delivery:</strong></span>
                  <span>{new Date(order.estimatedDeliveryDate).toLocaleDateString()}</span>
                </div>
              )}
              <div className="shippingLabelDetailRow">
                <span><strong>Items:</strong></span>
                <span>{order.products?.length || 0} item(s)</span>
              </div>
              <div className="shippingLabelDetailRow">
                <span><strong>Weight:</strong></span>
                <span>N/A</span>
              </div>
            </div>

            {/* Barcode Area (placeholder) */}
            <div className="shippingLabelBarcode">
              <div className="barcodePlaceholder">
                <p>Barcode/QR Code Area</p>
                <p className="barcodeText">{order.orderNumber}</p>
              </div>
            </div>

            {/* Handling Instructions */}
            {order.adminNotes && (
              <div className="shippingLabelInstructions">
                <strong>Special Instructions:</strong>
                <p>{order.adminNotes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="shippingLabelFooter">
              <p>Handle with care | Fragile items</p>
            </div>
          </div>
        </div>
        
        <div className="shippingLabelPopupActions">
          <button
            type="button"
            className="btnSecondary"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="btnPrimary"
            onClick={handlePrint}
          >
            🖨️ Print Shipping Label
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShippingLabelPopup;
