import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import '../css/styles.css';

const InvoicePopup = ({ isVisible, order, onClose, onPrint }) => {
  const [company, setCompany] = useState(null);

  // Helper function to normalize logo URL
  const normalizeLogoUrl = (logoUrl) => {
    if (!logoUrl) return null;
    
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      if (logoUrl.includes('/backend/uploads/') || logoUrl.includes('/Users/')) {
        const filename = logoUrl.split('/').pop();
        return `http://localhost:8080/uploads/${filename}`;
      }
      return logoUrl;
    }
    
    if (logoUrl.includes('/backend/uploads/') || logoUrl.includes('/Users/')) {
      const filename = logoUrl.split('/').pop();
      return `http://localhost:8080/uploads/${filename}`;
    }
    
    if (logoUrl.startsWith('/uploads/') || logoUrl.startsWith('/')) {
      return `http://localhost:8080${logoUrl}`;
    }
    
    return `http://localhost:8080/uploads/${logoUrl}`;
  };

  useEffect(() => {
    if (isVisible && order) {
      // Fetch company data based on order's website
      const fetchCompany = async () => {
        try {
          let url = '/companies/default';
          // If order has a website, fetch company for that website
          if (order.website) {
            // Handle both object (populated) and string (ID) cases
            let websiteId = null;
            let websiteDomain = null;
            
            if (typeof order.website === 'string') {
              websiteId = order.website;
            } else if (order.website && typeof order.website === 'object') {
              websiteId = order.website._id || null;
              websiteDomain = order.website.domain || null;
            }
            
            if (websiteId) {
              url = `/companies/default?websiteId=${websiteId}`;
            } else if (websiteDomain) {
              url = `/companies/default?domain=${websiteDomain}`;
            }
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
          // Fallback to default values if API fails
          setCompany(null);
        }
      };
      fetchCompany();
    }
  }, [isVisible, order]);

  if (!isVisible || !order) return null;

  const calculateSubtotal = () => {
    return order.products?.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0) || order.subtotal || 0;
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const tax = order.tax || 0;
    const shipping = order.shippingCharges || 0;
    const discount = order.discount || 0;
    return subtotal + tax + shipping - discount;
  };

  const handlePrint = () => {
    window.print();
    if (onPrint) onPrint();
  };

  // Company info with fallback
  const companyName = company?.name || 'PhotuPrint';
  const companyAddress = company?.address 
    ? [
        company.address.street,
        company.address.city,
        company.address.state,
        company.address.zipCode,
        company.address.country
      ].filter(Boolean).join(', ') || 'Your Company Address'
    : 'Your Company Address';
  const companyEmail = company?.email || 'info@photuprint.com';
  const companyPhone = company?.phone || '+91 1234567890';
  const companyFooterText = company?.footerText || 'For any queries, please contact us at info@photuprint.com';

  return (
    <div className="invoicePopupOverlay" onClick={onClose}>
      <div className="invoicePopup" onClick={(e) => e.stopPropagation()}>
        <div className="invoicePopupHeader">
          <h2 className="invoicePopupTitle">Invoice - Order #{order.orderNumber}</h2>
          <button className="invoicePopupClose" onClick={onClose}>✕</button>
        </div>
        
        <div className="invoicePopupBody" id="invoice-content">
          {/* Invoice Content */}
          <div className="invoiceContent">
            {/* Header */}
            <div className="invoiceHeader">
              <div className="invoiceCompanyInfo">
                {company?.logo && (
                  <img 
                    src={company.logo} 
                    alt={companyName}
                    style={{ maxHeight: '60px', marginBottom: '10px', objectFit: 'contain' }}
                    onError={(e) => {
                      console.error('Company logo failed to load:', company.logo);
                      e.target.style.display = 'none';
                    }}
                  />
                )}
                <h1 className="invoiceCompanyName">{companyName}</h1>
                <p className="invoiceCompanyAddress">{companyAddress}</p>
                <p className="invoiceCompanyContact">
                  {companyEmail && `Email: ${companyEmail}`}
                  {companyEmail && companyPhone && ' | '}
                  {companyPhone && `Phone: ${companyPhone}`}
                </p>
                {company?.gstNumber && (
                  <p className="invoiceCompanyContact">GST: {company.gstNumber}</p>
                )}
                {company?.panNumber && (
                  <p className="invoiceCompanyContact">PAN: {company.panNumber}</p>
                )}
                {(company?.websiteUrl || (company?.website && typeof company.website === 'object' && company.website.domain) || (company?.website && typeof company.website === 'string')) && (
                  <p className="invoiceCompanyContact">
                    Website: {company.websiteUrl || (company.website && typeof company.website === 'object' ? company.website.domain : company.website) || ''}
                  </p>
                )}
              </div>
              <div className="invoiceInvoiceInfo">
                <h3 className="invoiceTitle">INVOICE</h3>
                <p><strong>Invoice #:</strong> {order.orderNumber}</p>
                <p><strong>Date:</strong> {new Date(order.createdAt).toLocaleDateString()}</p>
                <p><strong>Order Date:</strong> {new Date(order.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Billing & Shipping */}
            <div className="invoiceAddresses">
              <div className="invoiceBillTo">
                <h4>Bill To:</h4>
                <p><strong>{order.user?.name || order.billingAddress?.name || 'N/A'}</strong></p>
                {order.billingAddress && (
                  <>
                    <p>{order.billingAddress.street}</p>
                    <p>{order.billingAddress.city}, {order.billingAddress.state} {order.billingAddress.zipCode}</p>
                    <p>{order.billingAddress.country}</p>
                    {order.billingAddress.phone && <p>Phone: {order.billingAddress.phone}</p>}
                  </>
                )}
                {order.user?.email && <p>Email: {order.user.email}</p>}
              </div>
              <div className="invoiceShipTo">
                <h4>Ship To:</h4>
                <p><strong>{order.shippingAddress?.name || order.user?.name || 'N/A'}</strong></p>
                {order.shippingAddress && (
                  <>
                    <p>{order.shippingAddress.street}</p>
                    <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}</p>
                    <p>{order.shippingAddress.country}</p>
                    {order.shippingAddress.phone && <p>Phone: {order.shippingAddress.phone}</p>}
                  </>
                )}
              </div>
            </div>

            {/* Order Items */}
            <div className="invoiceItems">
              <table className="invoiceTable">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.products?.map((item, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>{item.productName || item.product?.name || 'Product'}</td>
                      <td>{item.quantity || 1}</td>
                      <td>₹{((item.price || 0)).toFixed(2)}</td>
                      <td>₹{((item.price || 0) * (item.quantity || 1)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="invoiceTotals">
              <div className="invoiceTotalsRow">
                <span>Subtotal:</span>
                <span>₹{calculateSubtotal().toFixed(2)}</span>
              </div>
              {order.tax > 0 && (
                <div className="invoiceTotalsRow">
                  <span>Tax:</span>
                  <span>₹{order.tax.toFixed(2)}</span>
                </div>
              )}
              {order.shippingCharges > 0 && (
                <div className="invoiceTotalsRow">
                  <span>Shipping:</span>
                  <span>₹{order.shippingCharges.toFixed(2)}</span>
                </div>
              )}
              {order.discount > 0 && (
                <div className="invoiceTotalsRow">
                  <span>Discount:</span>
                  <span>-₹{order.discount.toFixed(2)}</span>
                </div>
              )}
              {order.couponCode && (
                <div className="invoiceTotalsRow">
                  <span>Coupon Code:</span>
                  <span>{order.couponCode}</span>
                </div>
              )}
              <div className="invoiceTotalsRow invoiceTotal">
                <span><strong>Total:</strong></span>
                <span><strong>₹{calculateTotal().toFixed(2)}</strong></span>
              </div>
            </div>

            {/* Payment Info */}
            <div className="invoicePaymentInfo">
              <p><strong>Payment Method:</strong> {order.paymentMethod?.replace('_', ' ').toUpperCase() || 'N/A'}</p>
              <p><strong>Payment Status:</strong> <span className={`paymentStatus ${order.paymentStatus}`}>{order.paymentStatus?.toUpperCase() || 'PENDING'}</span></p>
              <p><strong>Order Status:</strong> {order.orderStatus?.toUpperCase() || 'PENDING'}</p>
              {order.trackingNumber && <p><strong>Tracking Number:</strong> {order.trackingNumber}</p>}
            </div>

            {/* Footer */}
            <div className="invoiceFooter">
              <p>{company?.footerText || 'Thank you for your business!'}</p>
              {!company?.footerText && companyEmail && (
                <p>For any queries, please contact us at {companyEmail}</p>
              )}
            </div>
          </div>
        </div>
        
        <div className="invoicePopupActions">
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
            🖨️ Print Invoice
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoicePopup;
