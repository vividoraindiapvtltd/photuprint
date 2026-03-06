import mongoose from 'mongoose';

// Get system status
export const getSystemStatus = async (req, res) => {
  try {
    const status = {
      timestamp: new Date().toISOString(),
      backend: 'online',
      database: 'offline',
      api: 'online',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    // Check database connection
    try {
      if (mongoose.connection.readyState === 1) {
        status.database = 'online';
        status.databaseDetails = {
          name: mongoose.connection.name,
          host: mongoose.connection.host,
          port: mongoose.connection.port
        };
      } else {
        status.database = 'offline';
        status.databaseDetails = {
          readyState: mongoose.connection.readyState,
          error: 'Database not connected'
        };
      }
    } catch (dbError) {
      status.database = 'error';
      status.databaseDetails = {
        error: dbError.message
      };
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    status.system = {
      memory: {
        used: Math.round(memUsage.used / 1024 / 1024 * 100) / 100 + ' MB',
        total: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100 + ' MB',
        external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100 + ' MB'
      },
      uptime: Math.round(process.uptime()) + ' seconds',
      nodeVersion: process.version,
      platform: process.platform
    };

    res.json(status);
  } catch (error) {
    console.error('Error getting system status:', error);
    res.status(500).json({ 
      msg: 'Failed to get system status',
      error: error.message 
    });
  }
};

// Health check endpoint (simple ping)
export const healthCheck = async (req, res) => {
  try {
    res.json({ 
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()) + ' seconds'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      error: error.message 
    });
  }
}; 