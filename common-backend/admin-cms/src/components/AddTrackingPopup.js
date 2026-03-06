import React, { useState } from 'react';
import api from '../api/axios';
import { FormField, AlertMessage } from '../common';
import '../css/styles.css';

const AddTrackingPopup = ({ isVisible, orderId, orderNumber, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    status: '',
    location: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear errors when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.status.trim()) {
      setError('Status is required');
      return;
    }

    if (!formData.location.trim()) {
      setError('Location is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const response = await api.post('/tracking/add', {
        orderId,
        status: formData.status.trim(),
        location: formData.location.trim(),
        description: formData.description.trim() || null
      });

      setSuccess('Tracking update added successfully!');
      
      // Reset form
      setFormData({
        status: '',
        location: '',
        description: ''
      });

      // Notify parent component
      if (onSuccess) {
        onSuccess(response.data.tracking);
      }

      // Auto close after 1.5 seconds
      setTimeout(() => {
        if (onClose) onClose();
      }, 1500);
    } catch (err) {
      console.error('Error adding tracking:', err);
      setError(err.response?.data?.msg || 'Failed to add tracking update. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      status: '',
      location: '',
      description: ''
    });
    setError('');
    setSuccess('');
    if (onClose) onClose();
  };

  if (!isVisible) return null;

  return (
    <div 
      className="modalOverlay"
      onClick={handleCancel}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}
    >
      <div 
        className="modalContent"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '30px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
        }}
      >
        {/* Header */}
        <div className="makeFlex spaceBetween alignCenter appendBottom20">
          <div>
            <h2 className="font24 fontBold blackText appendBottom4">
              Add Tracking Update
            </h2>
            <p className="font14 grayText">
              Order: {orderNumber || orderId}
            </p>
          </div>
          <button
            onClick={handleCancel}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666',
              padding: '0',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {/* Messages */}
        <AlertMessage
          type="error"
          message={error}
          onClose={() => setError('')}
          autoClose={false}
        />
        <AlertMessage
          type="success"
          message={success}
          onClose={() => setSuccess('')}
          autoClose={false}
        />

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="makeFlex column gap16">
            <FormField
              type="text"
              name="status"
              label="Status"
              value={formData.status}
              onChange={handleChange}
              placeholder="e.g., Shipped, In Transit, Out for Delivery, Delivered"
              required={true}
              info="Enter the current status of the order"
            />

            <FormField
              type="text"
              name="location"
              label="Location"
              value={formData.location}
              onChange={handleChange}
              placeholder="e.g., Mumbai Warehouse, Delhi Hub, Customer Address"
              required={true}
              info="Enter the current location of the shipment"
            />

            <FormField
              type="textarea"
              name="description"
              label="Description (Optional)"
              value={formData.description}
              onChange={handleChange}
              placeholder="Additional details about this tracking update..."
              rows={4}
              info="Optional: Add any additional information about this update"
            />
          </div>

          {/* Form Actions */}
          <div className="formActions paddingTop24">
            <button
              type="submit"
              disabled={loading}
              className="btnPrimary"
            >
              {loading ? (
                <span className="loadingSpinner">⏳</span>
              ) : (
                <span>Add Tracking Update</span>
              )}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="btnSecondary"
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddTrackingPopup;
