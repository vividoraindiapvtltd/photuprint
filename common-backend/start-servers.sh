#!/bin/bash

echo "🚀 Starting PhotuPrint Admin CMS System..."
echo ""

# Function to get local IP address
get_local_ip() {
    ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1
}

LOCAL_IP=$(get_local_ip)

echo "📱 Your local IP address: $LOCAL_IP"
echo ""

# Kill any existing processes
echo "🔄 Stopping existing servers..."
pkill -f "node backend/index.js" 2>/dev/null
pkill -f "react-scripts" 2>/dev/null
sleep 2

# Start backend server
echo "🔧 Starting Backend Server..."
cd backend
node index.js &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend server
echo "🎨 Starting Frontend Server..."
cd admin-cms
npm start &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Servers are starting up..."
echo ""
echo "🌐 Access URLs:"
echo "   Frontend (Desktop): http://localhost:3000"
echo "   Frontend (Mobile):  http://$LOCAL_IP:3000"
echo "   Backend API:        http://localhost:8080"
echo "   Backend API (Mobile): http://$LOCAL_IP:8080"
echo ""
echo "🔐 Test Login Credentials:"
echo "   Email: admin@photuprint.com"
echo "   Password: admin123"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for user to stop
wait 