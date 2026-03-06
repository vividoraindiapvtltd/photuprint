import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * AccessDenied Component
 * 
 * Displayed when a user tries to access a route they don't have permission for.
 * Provides a clear message and navigation options.
 */
const AccessDenied = () => {
  const navigate = useNavigate();

  return (
    <div className="accessDeniedContainer" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      padding: '40px 20px',
      textAlign: 'center'
    }}>
      {/* Icon */}
      <div className="iconWrapper" style={{
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '32px',
        boxShadow: '0 10px 40px rgba(238, 90, 90, 0.3)'
      }}>
        <span style={{ fontSize: '60px' }}>🚫</span>
      </div>

      {/* Title */}
      <h1 style={{
        fontSize: '36px',
        fontWeight: '700',
        color: '#2d3436',
        marginBottom: '16px'
      }}>
        Access Denied
      </h1>

      {/* Description */}
      <p style={{
        fontSize: '18px',
        color: '#636e72',
        maxWidth: '500px',
        marginBottom: '32px',
        lineHeight: '1.6'
      }}>
        You don't have permission to access this page. If you believe this is an error,
        please contact your administrator.
      </p>

      {/* Error Code */}
      <div style={{
        padding: '12px 24px',
        background: '#f8f9fa',
        borderRadius: '8px',
        marginBottom: '32px',
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#6c757d'
      }}>
        Error Code: 403 - Forbidden
      </div>

      {/* Actions */}
      <div className="actionButtons" style={{
        display: 'flex',
        gap: '16px',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        <button
          onClick={() => navigate(-1)}
          className="btnSecondary"
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            borderRadius: '8px',
            cursor: 'pointer',
            border: '2px solid #007bff',
            background: 'transparent',
            color: '#007bff',
            fontWeight: '600',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            e.target.style.background = '#007bff';
            e.target.style.color = '#fff';
          }}
          onMouseOut={(e) => {
            e.target.style.background = 'transparent';
            e.target.style.color = '#007bff';
          }}
        >
          ← Go Back
        </button>
        
        <button
          onClick={() => navigate('/dashboard')}
          className="btnPrimary"
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            borderRadius: '8px',
            cursor: 'pointer',
            border: 'none',
            background: '#007bff',
            color: '#fff',
            fontWeight: '600',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            e.target.style.background = '#0056b3';
          }}
          onMouseOut={(e) => {
            e.target.style.background = '#007bff';
          }}
        >
          Go to Dashboard
        </button>
      </div>

      {/* Help Text */}
      <div style={{
        marginTop: '48px',
        padding: '20px',
        background: '#e8f4fd',
        borderRadius: '8px',
        maxWidth: '600px'
      }}>
        <h4 style={{
          fontSize: '14px',
          fontWeight: '600',
          color: '#0c5460',
          marginBottom: '8px'
        }}>
          Need help?
        </h4>
        <p style={{
          fontSize: '13px',
          color: '#0c5460',
          margin: 0,
          lineHeight: '1.5'
        }}>
          If you need access to this feature, please contact your system administrator
          or the Super Admin to request the necessary permissions.
        </p>
      </div>
    </div>
  );
};

export default AccessDenied;
