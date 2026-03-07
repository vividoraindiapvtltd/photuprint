import { GoogleOAuthProvider } from "@react-oauth/google"
import { AuthProvider } from "../context/AuthContext"
import "../styles/globals.css"

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""

export default function App({ Component, pageProps }) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </GoogleOAuthProvider>
  )
}
