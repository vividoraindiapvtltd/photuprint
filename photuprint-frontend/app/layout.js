"use client"

import { GoogleOAuthProvider } from "@react-oauth/google"
import { AuthProvider } from "../src/context/AuthContext"
import "../src/styles/globals.css"

// Google OAuth Client ID
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_HERE"

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="PhotuPrint - Custom Product Design Platform" />
        <title>PhotuPrint</title>
      </head>
      <body>
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
          <AuthProvider>{children}</AuthProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  )
}
