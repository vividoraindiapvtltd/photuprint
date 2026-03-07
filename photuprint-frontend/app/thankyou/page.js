"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import TopBar from "../../components/TopBar"
import NavigationBar from "../../components/NavigationBar"
import Footer from "../../components/Footer"

export default function ThankYouPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><span className="text-gray-500">Loading...</span></div>}>
      <ThankYouInner />
    </Suspense>
  )
}

function ThankYouInner() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get("orderId")
  const status = searchParams.get("status")
  const reason = searchParams.get("reason")
  const isCancelled = status === "cancelled"
  const isFailed = status === "failed"

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 w-full">
        <TopBar />
        <NavigationBar />
      </header>
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="max-w-md mx-auto bg-white rounded-xl border border-gray-200 p-8">
          {isCancelled || isFailed ? (
            <>
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {isCancelled ? "Payment cancelled" : "Payment failed"}
              </h1>
              <p className="text-gray-600 mb-2">
                Order status: <span className="font-semibold">{isCancelled ? "Cancelled" : "Failed"}</span>
              </p>
              <p className="text-gray-500 text-sm mb-6">
                {isCancelled
                  ? "You closed the payment window. Your cart is still available—you can complete the order anytime."
                  : reason
                    ? reason
                    : "The payment could not be completed. Please try again or use a different payment method."}
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Order placed successfully</h1>
              {orderId && (
                <p className="text-gray-600 mb-6">
                  Order ID: <span className="font-mono font-medium">{orderId}</span>
                </p>
              )}
              <p className="text-gray-500 text-sm mb-6">
                Thank you for your order. We&apos;ve sent a confirmation email and SMS. We&apos;ll notify you when your order ships.
              </p>
            </>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="px-6 py-3 bg-gray-900 text-white font-semibold rounded-md hover:bg-gray-800"
            >
              Continue Shopping
            </Link>
            {(isCancelled || isFailed) ? (
              <Link
                href="/cart"
                className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50"
              >
                Back to Cart
              </Link>
            ) : (
              <Link
                href="/account"
                className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50"
              >
                My Orders
              </Link>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
