import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import api from '../api/axios';
import '../css/styles.css';

const TrackingComponent = ({ orderId, onClose }) => {
  const [trackingHistory, setTrackingHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  // Fetch initial tracking history
  const fetchTrackingHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/tracking/${orderId}`);
      setTrackingHistory(response.data.trackingHistory || []);
    } catch (err) {
      console.error('Error fetching tracking history:', err);
      setError(err.response?.data?.msg || 'Failed to fetch tracking history');
    } finally {
      setLoading(false);
    }
  };

  // Setup Socket.io connection
  useEffect(() => {
    if (!orderId) return;

    // Get JWT token from localStorage
    const user = JSON.parse(localStorage.getItem('adminUser'));
    const token = user?.token;

    if (!token) {
      setError('Authentication token not found. Please login again.');
      return;
    }

    // Initialize Socket.io connection
    const socketUrl = process.env.REACT_APP_SOCKET_URL || '';
    const newSocket = io(socketUrl, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling']
    });

    socketRef.current = newSocket;

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('✅ Connected to tracking server');
      setIsConnected(true);
      
      // Join order room
      newSocket.emit('joinOrderRoom', orderId);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from tracking server');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setError('Failed to connect to tracking server. Please refresh the page.');
      setIsConnected(false);
    });

    newSocket.on('joinedRoom', (data) => {
      console.log('Joined room:', data);
    });

    // Listen for tracking updates
    newSocket.on('trackingUpdated', (data) => {
      console.log('📦 New tracking update received:', data);
      
      if (data.tracking) {
        // Add new tracking update to history (at the beginning since it's the latest)
        setTrackingHistory(prev => {
          // Check if this tracking already exists (by _id)
          const exists = prev.some(t => t._id === data.tracking._id);
          if (exists) {
            // Update existing tracking
            return prev.map(t => 
              t._id === data.tracking._id ? data.tracking : t
            );
          } else {
            // Add new tracking at the beginning
            return [data.tracking, ...prev];
          }
        });
      }
    });

    setSocket(newSocket);

    // Fetch initial tracking history
    fetchTrackingHistory();

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leaveOrderRoom', orderId);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [orderId]);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status badge color
  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('delivered')) return 'greenText';
    if (statusLower.includes('shipped') || statusLower.includes('in transit')) return 'blueText';
    if (statusLower.includes('pending') || statusLower.includes('processing')) return 'orangeText';
    if (statusLower.includes('cancelled') || statusLower.includes('failed')) return 'redText';
    return 'grayText';
  };

  if (!orderId) {
    return (
      <div className="paddingAll20">
        <div className="alertMessage error">Order ID is required</div>
      </div>
    );
  }

  return (
    <div className="trackingComponentContainer" style={{ padding: '20px' }}>
      {/* Header */}
      <div className="makeFlex spaceBetween alignCenter appendBottom20">
        <div>
          <h2 className="font24 fontBold blackText appendBottom8">
            📦 Order Tracking - #{orderId}
          </h2>
          <div className="makeFlex gap10 alignCenter">
            <div 
              className={`statusBadge ${isConnected ? 'greenText' : 'redText'}`}
              style={{
                padding: '4px 12px',
                borderRadius: '12px',
                backgroundColor: isConnected ? '#d4edda' : '#f8d7da',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              {isConnected ? '🟢 Live' : '🔴 Offline'}
            </div>
            {loading && <span className="grayText font14">Loading...</span>}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="btnSecondary"
            style={{ padding: '8px 16px' }}
          >
            ✕ Close
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="alertMessage error appendBottom20">
          {error}
        </div>
      )}

      {/* Tracking History */}
      {loading ? (
        <div className="textCenter paddingAll40">
          <div className="loadingSpinner">⏳</div>
          <p className="grayText font16 appendTop10">Loading tracking history...</p>
        </div>
      ) : trackingHistory.length === 0 ? (
        <div className="textCenter paddingAll40">
          <div className="emptyIcon appendBottom16">📦</div>
          <h3 className="font18 fontSemiBold grayText appendBottom8">
            No Tracking Information
          </h3>
          <p className="font14 grayText">
            Tracking updates will appear here once the order is shipped.
          </p>
        </div>
      ) : (
        <div className="trackingHistoryContainer">
          <div className="trackingTimeline">
            {trackingHistory.map((tracking, index) => (
              <div
                key={tracking._id || index}
                className="trackingItem"
                style={{
                  position: 'relative',
                  paddingLeft: '30px',
                  paddingBottom: '30px',
                  borderLeft: index < trackingHistory.length - 1 ? '2px solid #e0e0e0' : 'none'
                }}
              >
                {/* Timeline dot */}
                <div
                  style={{
                    position: 'absolute',
                    left: '-6px',
                    top: '0',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: index === 0 ? '#007bff' : '#e0e0e0',
                    border: '2px solid white',
                    boxShadow: '0 0 0 2px #007bff'
                  }}
                />

                {/* Tracking content */}
                <div className="trackingContent">
                  <div className="makeFlex spaceBetween alignStart appendBottom8">
                    <div className="flexOne">
                      <h4
                        className={`font16 fontBold ${getStatusColor(tracking.status)}`}
                        style={{ marginBottom: '4px' }}
                      >
                        {tracking.status}
                      </h4>
                      <p className="font14 blackText" style={{ marginBottom: '4px' }}>
                        📍 {tracking.location}
                      </p>
                      {tracking.description && (
                        <p className="font13 grayText" style={{ marginTop: '4px' }}>
                          {tracking.description}
                        </p>
                      )}
                    </div>
                    <div className="textRight" style={{ minWidth: '150px' }}>
                      <p className="font12 grayText">
                        {formatDate(tracking.updatedAt)}
                      </p>
                      {tracking.updatedBy && (
                        <p className="font11 grayText" style={{ marginTop: '4px' }}>
                          by {tracking.updatedBy.name || 'Admin'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connection Status Footer */}
      <div
        className="textCenter paddingTop20"
        style={{
          borderTop: '1px solid #e0e0e0',
          marginTop: '20px',
          paddingTop: '15px'
        }}
      >
        <p className="font12 grayText">
          {isConnected
            ? '🟢 Real-time tracking is active. You will receive live updates.'
            : '🔴 Real-time tracking is offline. Updates may be delayed.'}
        </p>
      </div>
    </div>
  );
};

export default TrackingComponent;
