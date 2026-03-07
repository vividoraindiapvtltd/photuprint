'use client'

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import ReviewForm from "../../src/components/ReviewForm"

function ReviewPageInner() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get("orderId") || ""
  const productId = searchParams.get("productId") || ""

  return <ReviewForm preselectedProductId={productId} orderId={orderId} />
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto p-6 text-center text-gray-500">Loading...</div>}>
      <ReviewPageInner />
    </Suspense>
  )
}
