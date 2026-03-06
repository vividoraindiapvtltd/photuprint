import React, { useState, useEffect } from 'react';
import api from '../api/axios';

export default function Status() {
  const [status, setStatus] = useState({
    backend: 'checking',
    database: 'checking',
    api: 'checking'
  });
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkSystemStatus();
  }, []);

  const checkSystemStatus = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get comprehensive system status from our API
      const response = await api.get('/status');
      const data = response.data;
      
      setStatus({
        backend: data.backend,
        database: data.database,
        api: data.api
      });
      
      setSystemInfo(data);
    } catch (error) {
      console.error('Error checking system status:', error);
      setError('Failed to check system status');
      
      // Fallback: check basic connectivity
      try {
        const response = await api.get('/users');
        setStatus({
          backend: 'online',
          database: 'unknown',
          api: 'online'
        });
      } catch (fallbackError) {
        setStatus({
          backend: 'offline',
          database: 'offline',
          api: 'offline'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return '#28a745';
      case 'offline': return '#dc3545';
      case 'error': return '#ffc107';
      default: return '#6c757d';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'online': return '✅ Online';
      case 'offline': return '❌ Offline';
      case 'error': return '⚠️ Error';
      default: return '⏳ Checking...';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', textAlign: 'center' }}>
        <h1>System Status</h1>
        <div style={{ fontSize: '18px', color: '#666' }}>Checking system status...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>System Status</h1>
      
      {error && (
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          border: '1px solid #f5c6cb', 
          borderRadius: '4px', 
          marginBottom: '20px' 
        }}>
          ⚠️ {error}
        </div>
      )}
      
      <div style={{ display: 'grid', gap: '20px', maxWidth: '800px' }}>
        <div style={{ 
          padding: '20px', 
          border: '1px solid #ddd', 
          borderRadius: '8px',
          backgroundColor: 'white'
        }}>
          <h3>Backend Server</h3>
          <p style={{ color: getStatusColor(status.backend) }}>
            {getStatusText(status.backend)}
          </p>
          <p>URL: {api.defaults.baseURL}</p>
          {systemInfo && (
            <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
              <p>Version: {systemInfo.version}</p>
              <p>Environment: {systemInfo.environment}</p>
              <p>Uptime: {systemInfo.system?.uptime}</p>
            </div>
          )}
        </div>

        <div style={{ 
          padding: '20px', 
          border: '1px solid #ddd', 
          borderRadius: '8px',
          backgroundColor: 'white'
        }}>
          <h3>API Endpoints</h3>
          <p style={{ color: getStatusColor(status.api) }}>
            {getStatusText(status.api)}
          </p>
          <p>Base URL: {api.defaults.baseURL}</p>
          {systemInfo && (
            <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
              <p>Last Check: {new Date(systemInfo.timestamp).toLocaleString()}</p>
            </div>
          )}
        </div>

        <div style={{ 
          padding: '20px', 
          border: '1px solid #ddd', 
          borderRadius: '8px',
          backgroundColor: 'white'
        }}>
          <h3>Database</h3>
          <p style={{ color: getStatusColor(status.database) }}>
            {getStatusText(status.database)}
          </p>
          <p>MongoDB Atlas</p>
          {systemInfo?.databaseDetails && (
            <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
              {systemInfo.database === 'online' ? (
                <>
                  <p>Name: {systemInfo.databaseDetails.name}</p>
                  <p>Host: {systemInfo.databaseDetails.host}</p>
                  <p>Port: {systemInfo.databaseDetails.port}</p>
                </>
              ) : (
                <p>Error: {systemInfo.databaseDetails.error}</p>
              )}
            </div>
          )}
        </div>

        {systemInfo?.system && (
          <div style={{ 
            padding: '20px', 
            border: '1px solid #ddd', 
            borderRadius: '8px',
            backgroundColor: 'white'
          }}>
            <h3>System Information</h3>
            <div style={{ fontSize: '14px', color: '#666' }}>
              <p><strong>Memory Usage:</strong></p>
              <p>• Used: {systemInfo.system.memory.used}</p>
              <p>• Total: {systemInfo.system.memory.total}</p>
              <p>• External: {systemInfo.system.memory.external}</p>
              <p><strong>Platform:</strong> {systemInfo.system.platform}</p>
              <p><strong>Node Version:</strong> {systemInfo.system.nodeVersion}</p>
            </div>
          </div>
        )}
      </div>

      <button 
        onClick={checkSystemStatus}
        disabled={loading}
        style={{
          marginTop: '20px',
          padding: '10px 20px',
          backgroundColor: loading ? '#6c757d' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Checking...' : 'Refresh Status'}
      </button>
    </div>
  );
} 