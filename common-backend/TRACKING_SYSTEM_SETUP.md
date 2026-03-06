# Tracking System Setup Guide

## Overview
A complete real-time order tracking system with:
- **Backend**: Node.js, Express, MongoDB (Mongoose)
- **Authentication**: JWT middleware protected routes
- **Real-time updates**: Socket.io
- **Frontend**: React with Socket.io-client

## Installation

### Backend Dependencies
```bash
cd /Users/mimran/Documents/Imran/projects/photuprint
npm install socket.io
```

### Frontend Dependencies
```bash
cd admin-cms
npm install socket.io-client
```

## Files Created

### Backend Files

1. **`backend/models/tracking.model.js`**
   - Mongoose model for tracking updates
   - Fields: orderId, status, location, description, updatedBy, updatedAt
   - Indexes for efficient queries

2. **`backend/controllers/tracking.controller.js`**
   - `addTracking()`: Save tracking updates, emit Socket.io events
   - `getTrackingByOrder()`: Fetch tracking history by orderId
   - `getLatestTracking()`: Get most recent tracking update

3. **`backend/routes/tracking.routes.js`**
   - `POST /api/tracking/add` (protected)
   - `GET /api/tracking/:orderId` (protected)
   - `GET /api/tracking/:orderId/latest` (protected)

4. **`backend/index.js`** (Updated)
   - Socket.io server setup with HTTP server
   - JWT authentication middleware for Socket.io
   - Room-based messaging (order-{orderId})
   - CORS configuration for React app

5. **`backend/app.js`** (Updated)
   - Registered tracking routes at `/api/tracking`

### Frontend Files

1. **`admin-cms/src/components/TrackingComponent.js`**
   - Real-time tracking display component
   - Connects to Socket.io server
   - Joins order room for live updates
   - Timeline view of tracking history
   - Connection status indicator

2. **`admin-cms/src/components/AddTrackingPopup.js`**
   - Modal form to add tracking updates
   - Form validation
   - Success/error handling

3. **`admin-cms/src/components/OrderManager.js`** (Updated)
   - Added tracking popup states
   - Added "Track" and "Add Update" buttons in card/list views
   - Integrated TrackingComponent and AddTrackingPopup

## Environment Variables

Add to `.env` file (if not already present):
```env
JWT_SECRET=your_jwt_secret_here
FRONTEND_URL=http://localhost:3000  # Optional, defaults to localhost:3000
```

## API Endpoints

### Add Tracking Update
```
POST /api/tracking/add
Headers: Authorization: Bearer <token>
Body: {
  orderId: "order_id",
  status: "Shipped",
  location: "Mumbai Warehouse",
  description: "Optional description"
}
```

### Get Tracking History
```
GET /api/tracking/:orderId
Headers: Authorization: Bearer <token>
Response: {
  orderId: "...",
  orderNumber: "...",
  trackingHistory: [...],
  count: 5
}
```

### Get Latest Tracking
```
GET /api/tracking/:orderId/latest
Headers: Authorization: Bearer <token>
Response: {
  orderId: "...",
  latestTracking: {...}
}
```

## Socket.io Events

### Client → Server
- `joinOrderRoom(orderId)`: Join room for specific order
- `leaveOrderRoom(orderId)`: Leave order room

### Server → Client
- `trackingUpdated`: Emitted when new tracking update is added
  ```javascript
  {
    tracking: {...},
    orderId: "..."
  }
  ```
- `joinedRoom`: Confirmation when room is joined
- `connect`: Socket connection established
- `disconnect`: Socket disconnected

## Usage

### In OrderManager
1. Click "📦 Track" button to view tracking history
2. Click "➕ Add Update" button to add new tracking update
3. Real-time updates appear automatically when other admins add updates

### Adding Tracking Updates
1. Click "➕ Add Update" on any order
2. Fill in:
   - **Status**: e.g., "Shipped", "In Transit", "Out for Delivery", "Delivered"
   - **Location**: Current location of shipment
   - **Description**: Optional additional details
3. Click "Add Tracking Update"
4. Update is saved and broadcasted to all connected clients viewing that order

### Viewing Tracking
1. Click "📦 Track" on any order
2. View timeline of all tracking updates
3. See real-time connection status (🟢 Live / 🔴 Offline)
4. New updates appear automatically without refresh

## Features

✅ JWT Authentication on all routes
✅ Socket.io real-time updates
✅ Room-based messaging (one order = one room)
✅ Timeline view of tracking history
✅ Connection status indicator
✅ Error handling and validation
✅ Responsive UI
✅ Auto-cleanup on component unmount

## Testing

1. Start backend server:
   ```bash
   npm run dev
   ```

2. Start frontend:
   ```bash
   cd admin-cms
   npm start
   ```

3. Login to admin panel
4. Navigate to Order Manager
5. Click "📦 Track" on any order
6. In another browser/tab, click "➕ Add Update" on the same order
7. Watch real-time update appear in the first tab!

## Troubleshooting

### Socket.io connection fails
- Check `FRONTEND_URL` in `.env` matches your React app URL
- Verify CORS settings in `backend/index.js`
- Check browser console for connection errors

### JWT authentication fails
- Ensure token is sent in Socket.io auth: `socket.io-client` auth config
- Verify `JWT_SECRET` matches between auth and Socket.io middleware

### No real-time updates
- Check Socket.io connection status (should show 🟢 Live)
- Verify orderId matches between client and server
- Check server logs for Socket.io events

## Security Notes

- All routes are protected with JWT middleware
- Socket.io connections require valid JWT token
- Users can only join rooms for orders they have access to
- Tracking updates include `updatedBy` field for audit trail
