"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function CheckoutPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/cart")
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600">Redirecting to cart...</p>
      </div>
    </div>
  )
}
