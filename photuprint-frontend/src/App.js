import React from "react"
import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { GoogleOAuthProvider } from "@react-oauth/google"
import { AuthProvider } from "./context/AuthContext"
import ProductDetails from "./pages/ProductDetails"
import ProductsList from "./pages/ProductsList"
import ReviewForm from "./components/ReviewForm"
import Login from "./pages/Login"
import Register from "./pages/Register"

// Google OAuth Client ID - Replace with your actual Google OAuth Client ID
// Get it from: https://console.cloud.google.com/apis/credentials
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_HERE"

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <Router>
        <Routes>
          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Product Details Page */}
          <Route path="/product/:productId" element={<ProductDetails />} />

          {/* Review Submission Routes */}
          <Route path="/product/:productId/review" element={<ReviewForm />} />
          <Route path="/review" element={<ReviewForm />} />

          {/* Home/Default Route - Products List (Post-Login Landing Page) */}
          <Route path="/" element={<ProductsList />} />
        </Routes>
      </Router>
      </AuthProvider>
    </GoogleOAuthProvider>
  )
}

export default App
