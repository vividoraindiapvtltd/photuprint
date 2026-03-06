import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { createServer } from "http"
import { Server as SocketIOServer } from "socket.io"
import connectDB from "./db/index.js"
import app, { setupRoutes } from "./app.js"
import jwt from "jsonwebtoken"
import User from "./models/user.model.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({
  path: path.join(__dirname, ".env"),
})

connectDB()
  .then(async () => {
    const PORT = process.env.PORT || 8080

    // Create HTTP server
    const httpServer = createServer(app)

    // Setup Socket.io with CORS for React app
    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      }
    })

    // Socket.io authentication middleware
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(" ")[1]
        
        if (!token) {
          return next(new Error("Authentication error: No token provided"))
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const user = await User.findById(decoded.id).select("-password")
        
        if (!user) {
          return next(new Error("Authentication error: User not found"))
        }

        socket.user = user
        next()
      } catch (error) {
        next(new Error("Authentication error: Invalid token"))
      }
    })

    // Socket.io connection handling
    io.on("connection", (socket) => {
      console.log(`✅ User connected: ${socket.user?.name || socket.id}`)

      // Join order room
      socket.on("joinOrderRoom", (orderId) => {
        if (orderId) {
          const room = `order-${orderId}`
          socket.join(room)
          console.log(`📦 User ${socket.user?.name || socket.id} joined room: ${room}`)
          socket.emit("joinedRoom", { room, orderId })
        }
      })

      // Leave order room
      socket.on("leaveOrderRoom", (orderId) => {
        if (orderId) {
          const room = `order-${orderId}`
          socket.leave(room)
          console.log(`📦 User ${socket.user?.name || socket.id} left room: ${room}`)
        }
      })

      // Handle disconnection
      socket.on("disconnect", () => {
        console.log(`❌ User disconnected: ${socket.user?.name || socket.id}`)
      })
    })

    // Store io instance in app for use in controllers
    app.set("io", io)

    // Set up routes after database connection
    try {
      await setupRoutes()
      console.log("✅ All routes set up successfully")
    } catch (error) {
      console.error("❌ Failed to set up routes:", error)
      throw error // Don't start server if routes fail
    }

    // Start server
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`)
      console.log(`📡 Socket.io server ready`)
    })
  })
  .catch((err) => {
    console.log("MONGO db connection failed!!!", err)
  })
