"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"

const ProductReviews = dynamic(() => import("../ProductReviews"), { ssr: false })
const ReviewForm = dynamic(() => import("../ReviewForm"), { ssr: false })

function displayRef(x) {
  if (x == null || x === "") return ""
  if (typeof x === "string") return x.trim()
  if (typeof x === "object") return String(x.name || x.title || "").trim()
  return String(x)
}

function stripHtmlToText(html) {
  if (!html || typeof html !== "string") return ""
  return String(html)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function buildHighlights(product) {
  const p = product || {}
  return [
    { label: "Design", value: displayRef(p.design) || displayRef(p.pattern) || "—" },
    { label: "Fit", value: displayRef(p.fitType) || displayRef(p.fit) || "—" },
    { label: "Waist Rise", value: displayRef(p.style) || displayRef(p.shape) || "—" },
    {
      label: "Occasion",
      value: displayRef(p.occasion) || displayRef(p.recommendedUsesForProduct) || "—",
    },
    {
      label: "Closure",
      value: displayRef(p.specialFeature) || displayRef(p.includedComponents) || "—",
    },
    {
      label: "Wash Care",
      value: displayRef(p.productCareInstructions) || "Machine wash as per tag",
    },
  ]
}

function ChevronDown({ open }) {
  return (
    <svg
      className={`w-5 h-5 text-gray-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

/**
 * Key highlights, accordions, trust badges, and tabbed reviews — below delivery / free shipping on PDP.
 */
export default function ProductPdpBelowFold({ product, productId, productSlug }) {
  const [descOpen, setDescOpen] = useState(false)
  const [returnsOpen, setReturnsOpen] = useState(false)
  const [reviewTab, setReviewTab] = useState("product")
  const [showWriteReview, setShowWriteReview] = useState(false)
  const [reviewsReloadKey, setReviewsReloadKey] = useState(0)

  const slugForReview = productSlug || product?.slug || product?.productId || ""

  useEffect(() => {
    if (reviewTab !== "product") setShowWriteReview(false)
  }, [reviewTab])

  useEffect(() => {
    const focusProductTab = () => setReviewTab("product")
    window.addEventListener("pdp-reviews:focus-product", focusProductTab)
    return () => window.removeEventListener("pdp-reviews:focus-product", focusProductTab)
  }, [])

  useEffect(() => {
    const openProductDetails = () => setDescOpen(true)
    window.addEventListener("pdp-product-details:open", openProductDetails)
    return () => window.removeEventListener("pdp-product-details:open", openProductDetails)
  }, [])

  const highlights = useMemo(() => buildHighlights(product), [product])
  const descText = useMemo(() => stripHtmlToText(product?.description), [product?.description])
  const brandName = displayRef(product?.brand) || "this brand"

  return (
    <div className="mt-6 w-full min-w-0 max-w-full space-y-6 md:mt-8 md:space-y-8">
      <section>
        <h2 className="text-base font-bold text-gray-900 mb-3 md:mb-4">Key Highlights</h2>
        <div className="divide-y divide-gray-200 border-t border-gray-200">
          {[0, 1, 2].map((row) => (
            <div key={row} className="grid grid-cols-2 gap-x-4 gap-y-2 py-3 md:gap-x-6">
              {highlights.slice(row * 2, row * 2 + 2).map((cell) => (
                <div key={cell.label}>
                  <p className="text-sm text-gray-500">{cell.label}</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{cell.value}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section
        id="pdp-product-details"
        className="scroll-mt-24 rounded-xl border border-gray-200 bg-white overflow-hidden md:scroll-mt-28"
      >
        <button
          type="button"
          onClick={() => setDescOpen((o) => !o)}
          className="flex w-full min-h-[52px] items-center gap-3 px-4 py-3 text-left bg-white hover:bg-white transition-colors md:min-h-0 md:py-4"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white border border-gray-200 text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h7"
              />
            </svg>
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-bold text-gray-900">Product details</span>
            <span className="block text-sm text-gray-500 mt-0.5">Manufacture, Care and Fit</span>
          </span>
          <ChevronDown open={descOpen} />
        </button>
        {descOpen && (
          <div className="px-4 pb-4 pt-0 border-t border-gray-100">
            <p className="text-sm text-gray-700 leading-relaxed max-md:pl-0 md:pl-[3.25rem]">
              {descText || "Detailed description and care information will appear here when available."}
            </p>
          </div>
        )}

        <div className="border-t border-gray-200" />

        <button
          type="button"
          onClick={() => setReturnsOpen((o) => !o)}
          className="flex w-full min-h-[52px] items-center gap-3 px-4 py-3 text-left bg-white hover:bg-white transition-colors md:min-h-0 md:py-4"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white border border-gray-200 text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-bold text-gray-900">15 Days Returns &amp; Exchange</span>
            <span className="block text-sm text-gray-500 mt-0.5">Know about return &amp; exchange policy</span>
          </span>
          <ChevronDown open={returnsOpen} />
        </button>
        {returnsOpen && (
          <div className="px-4 pb-4 pt-0 border-t border-gray-100">
            <p className="text-sm text-gray-700 leading-relaxed max-md:pl-0 md:pl-[3.25rem]">
              You may return or exchange eligible items within 15 days of delivery. Items must be unused, with tags
              and original packaging where applicable. Refunds are processed after we receive and inspect the return.
              For full terms, see our returns policy or contact support.
            </p>
          </div>
        )}
      </section>

      <section className="flex flex-row justify-between gap-3 text-center sm:gap-4">
        <div className="flex-1 flex flex-col items-center gap-2">
          <div className="relative w-14 h-14 flex items-center justify-center text-gray-600">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span className="pointer-events-none absolute -top-0.5 left-1/2 -translate-x-1/2 rounded bg-amber-400 px-1 py-0.5 text-[0.45rem] font-extrabold uppercase leading-none text-white">
              Original
            </span>
          </div>
          <p className="text-[0.65rem] sm:text-xs font-bold text-gray-800 uppercase tracking-wide leading-tight">
            100% Genuine Product
          </p>
        </div>
        <div className="flex-1 flex flex-col items-center gap-2">
          <div className="relative w-14 h-14 text-gray-600">
            <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span className="absolute -right-0.5 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-white">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </span>
          </div>
          <p className="text-[0.65rem] sm:text-xs font-bold text-gray-800 uppercase tracking-wide leading-tight">
            100% Secure Payment
          </p>
        </div>
        <div className="flex-1 flex flex-col items-center gap-2">
          <div className="relative w-14 h-14 text-gray-600 flex items-center justify-center">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            <svg
              className="absolute w-6 h-6 text-amber-500 -right-0.5 -bottom-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
          <p className="text-[0.65rem] sm:text-xs font-bold text-gray-800 uppercase tracking-wide leading-tight">
            Easy Returns &amp; Instant Refunds
          </p>
        </div>
      </section>

      <section
        id="pdp-reviews"
        className="scroll-mt-24 rounded-xl border border-gray-200 bg-white p-1 md:scroll-mt-28"
      >
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setReviewTab("product")}
            className={`flex-1 rounded-lg py-3 text-sm font-semibold transition-shadow min-h-[48px] sm:min-h-0 sm:py-2.5 ${
              reviewTab === "product"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Product Reviews
          </button>
          <button
            type="button"
            onClick={() => setReviewTab("brand")}
            className={`flex-1 rounded-lg py-3 text-sm font-semibold transition-shadow min-h-[48px] sm:min-h-0 sm:py-2.5 ${
              reviewTab === "brand"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Brand Reviews
          </button>
        </div>
        <div className="bg-white rounded-b-lg rounded-t-none mt-0 px-4 py-6 border-t border-gray-100/80 [&_div.mt-8]:mt-0 [&_h2]:text-base [&_h2]:font-bold [&_h2]:mb-3">
          {reviewTab === "product" && productId && (
            <>
              {showWriteReview ? (
                <ReviewForm
                  embedded
                  preselectedProductId={slugForReview || String(productId)}
                  onReviewSubmitted={() => {
                    setReviewsReloadKey((k) => k + 1)
                    setShowWriteReview(false)
                  }}
                  onCancel={() => setShowWriteReview(false)}
                />
              ) : (
                <>
                  <div className="flex justify-end mb-2">
                    <button
                      type="button"
                      onClick={() => setShowWriteReview(true)}
                      className="min-h-[44px] rounded-md px-2 py-1 text-sm font-semibold text-blue-600 underline underline-offset-2 hover:bg-blue-50 hover:text-blue-800 sm:min-h-0"
                    >
                      Write a review
                    </button>
                  </div>
                  <ProductReviews productId={productId} reloadKey={reviewsReloadKey} />
                </>
              )}
            </>
          )}
          {reviewTab === "product" && !productId && (
            <p className="text-sm text-gray-500 text-center py-6">Reviews are unavailable for this product.</p>
          )}
          {reviewTab === "brand" && (
            <div className="text-center py-6 px-2">
              <p className="text-sm text-gray-700">
                Brand reviews for <span className="font-semibold">{brandName}</span> aggregate feedback across products.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Switch to <span className="font-medium text-gray-700">Product Reviews</span> to read ratings for this
                item.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
