"use client"

import dynamic from "next/dynamic"
import { GoogleOAuthProvider } from "@react-oauth/google"
import { AuthProvider } from "../src/context/AuthContext"
import { CartProvider } from "../src/context/CartContext"

const LoginModal = dynamic(() => import("../src/components/LoginModal"), { ssr: false })

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_HERE"

export default function Providers({ children }) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <CartProvider>
          {children}
          <LoginModal />
        </CartProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  )
}
