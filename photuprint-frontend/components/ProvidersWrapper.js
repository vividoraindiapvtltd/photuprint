"use client"

import dynamic from "next/dynamic"

const Providers = dynamic(() => import("./Providers"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-blue-600" />
    </div>
  ),
})

export default function ProvidersWrapper({ children }) {
  return <Providers>{children}</Providers>
}
