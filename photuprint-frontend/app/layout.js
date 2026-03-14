import { Inter } from "next/font/google"
import Providers from "../components/Providers"
import "../src/styles/globals.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://photuprint.com"),
  title: {
    default: "PhotuPrint — Custom Products & Photo Printing",
    template: "%s | PhotuPrint",
  },
  description: "Design custom products, phone covers, photo prints and more. Premium quality with fast delivery across India.",
  keywords: ["custom products", "photo printing", "phone covers", "personalized gifts", "PhotuPrint"],
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "PhotuPrint",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111827",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
