"use client"

import Link from "next/link"
import Image from "next/image"
import { getImageSrc } from "../../src/utils/imageUrl"

/** Order summary column (desktop sidebar or mobile sheet body). */
export default function OrderSummaryPanel({
  items,
  subtotal,
  discount,
  appliedCoupon,
  handleRemoveCoupon,
  availableCoupons,
  couponsLoading,
  hasAnyCoupons,
  validateAndComputeCoupon,
  handleApplyCoupon,
  couponCode,
  setCouponCode,
  setCouponError,
  couponError,
  giftVoucherExpanded,
  setGiftVoucherExpanded,
  isAuthenticated,
  openLoginModal,
  giftVoucherCode,
  setGiftVoucherCode,
  giftWrapChecked,
  setGiftWrapChecked,
  giftWrapPrice,
  tssExpanded,
  setTssExpanded,
  tssMoneyChecked,
  setTssMoneyChecked,
  tssPointsChecked,
  setTssPointsChecked,
  giftWrapCharge,
  shippingCharge,
  taxTotal,
  isDelhi,
  cgst,
  sgst,
  igst = 0,
  gstRatePercent,
  totalAmount,
  paymentMethod,
  checkoutStarted,
  advanceAmount,
  codRemaining,
  canPlaceOrder,
  placing,
  handlePlaceOrder,
  handleProceedToCheckout,
  resolveImageUrl,
  billingComplete,
  shippingComplete,
  className = "",
  /** Mobile bottom sheet: price breakup only (no CTAs; checkout runs from cart footer) */
  variant = "default",
}) {
  const isMobileSheet = variant === "mobileSheet"

  const summaryTitle = isMobileSheet ? <h2 className="sr-only">Order summary details</h2> : <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide mb-4">Order Summary</h2>

  const scrollBody = (
    <>
      {isMobileSheet ? summaryTitle : null}
      <ul className="divide-y divide-gray-200 mb-4">
        {items.map((item) => {
          const price = item.discountedPrice != null ? item.discountedPrice : item.price
          const lineTotal = price * (item.quantity || 0)
          const imgSrc = item.customDesign?.image || item.image
          const src = imgSrc ? resolveImageUrl(imgSrc) : null
          return (
            <li key={item.lineId} className="flex gap-3 py-3">
              <div className="relative w-14 h-14 bg-gray-100 rounded overflow-hidden flex-shrink-0">{src ? <Image src={getImageSrc(src) || src} alt={item.name} width={56} height={56} className="w-full h-full object-cover" /> : <div className="w-full h-14 bg-gray-200" />}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 line-clamp-2">{item.name}</p>
                <p className="text-xs text-gray-500">
                  Qty: {item.quantity} × ₹{price.toFixed(0)}
                </p>
              </div>
              <p className="text-sm font-semibold text-gray-900 flex-shrink-0">₹{lineTotal.toFixed(0)}</p>
            </li>
          )
        })}
      </ul>

      {/* Coupons: desktop sidebar + mobile price summary — same place relative to lines & totals (best UX: adjust total in this view) */}
      <div className={`mb-4 ${isMobileSheet ? "border-t border-gray-200 pt-4" : ""}`}>
          <label className="block text-sm font-medium text-gray-700 mb-2">{isMobileSheet ? "Promo & coupons" : "Available Coupons"}</label>
          {couponsLoading ? (
            <p className="text-xs text-gray-500">Loading coupons...</p>
          ) : availableCoupons.length > 0 ? (
            <ul className="space-y-2 mb-3">
              {availableCoupons.map((c) => {
                const res = validateAndComputeCoupon(c, subtotal)
                const isApplied = appliedCoupon && (String(appliedCoupon._id || appliedCoupon.id) === String(c._id || c.id) || (appliedCoupon.code || "").toUpperCase() === (c.code || "").toUpperCase())
                const canApply = res.valid && !isApplied
                const code = c.code || `COUPON-${(c._id || c.id || "").toString().slice(-6)}`
                const isProductSpecific = c.applicableProductIds && Array.isArray(c.applicableProductIds) && c.applicableProductIds.length > 0
                const isBankOffer = c.isBankOffer === true
                const label = c.discountType === "percentage" ? `${code} — ${c.discountValue}% off` : `${code} — ₹${(c.discountValue || 0).toFixed(0)} off`
                return (
                  <li key={c._id || c.id} className="flex items-center justify-between gap-2 p-2 border border-gray-200 rounded-lg">
                    <span className="text-sm font-medium text-gray-700 truncate">
                      {label}
                      {isBankOffer && <span className="block text-xs text-gray-500 font-normal">Bank offer</span>}
                      {isProductSpecific && !isBankOffer && <span className="block text-xs text-gray-500 font-normal">Product specific</span>}
                    </span>
                    {isApplied ? (
                      <span className="flex-shrink-0 text-xs text-green-600 font-medium">Applied</span>
                    ) : canApply ? (
                      <button type="button" onClick={() => handleApplyCoupon(null, c)} className="flex-shrink-0 text-xs font-medium text-gray-900 underline hover:text-gray-600">
                        Apply
                      </button>
                    ) : (
                      <span className="flex-shrink-0 text-xs text-gray-400">{res.error || "—"}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-xs text-gray-500 mb-3">{hasAnyCoupons ? "No bank or product-specific coupons apply. Enter your code below to apply a coupon." : "No coupons available."}</p>
          )}

          <form onSubmit={handleApplyCoupon} className="mt-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Have a code?</label>
            <div className={isMobileSheet ? "flex flex-col gap-2" : "flex gap-2"}>
              <input
                type="text"
                placeholder="Enter code"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value)
                  setCouponError("")
                }}
                className="min-h-[44px] w-full flex-1 px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
              />
              <button
                type="submit"
                className={`border border-gray-900 font-medium text-gray-900 text-sm transition-colors hover:bg-gray-50 ${isMobileSheet ? "min-h-[44px] w-full rounded-md py-2.5" : "rounded-md px-4 py-2"}`}
              >
                Apply
              </button>
            </div>
            {appliedCoupon && (
              <p className="mt-2 flex items-center gap-2">
                <span className="text-xs text-green-600 font-medium">
                  {appliedCoupon.code} applied (−₹{discount.toFixed(0)})
                </span>
                <button type="button" onClick={handleRemoveCoupon} className="text-xs text-gray-500 hover:text-red-600 underline">
                  Remove
                </button>
              </p>
            )}
            {couponError && <p className="mt-1 text-xs text-red-600">{couponError}</p>}
          </form>
          <p className="mt-3 text-xs text-gray-500 italic">Offer valid per single unit of the specified product.</p>
      </div>

      {!isMobileSheet && (
        <div className="mb-4 pt-4 border-t border-gray-200">
          <button type="button" onClick={() => setGiftVoucherExpanded(!giftVoucherExpanded)} className="flex items-center justify-between w-full text-left">
            <span className="flex items-center gap-2 font-semibold text-gray-900">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Gift Voucher
            </span>
            <svg className={`w-5 h-5 text-gray-500 transition-transform ${giftVoucherExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {giftVoucherExpanded && (
            <div className="mt-3 space-y-2">
              {!isAuthenticated ? (
                <button type="button" onClick={() => openLoginModal("/cart")} className="text-sm text-blue-600 hover:text-blue-700 underline">
                  Login to Apply.
                </button>
              ) : (
                <input type="text" placeholder="Enter Code Here" value={giftVoucherCode} onChange={(e) => setGiftVoucherCode(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900" />
              )}
            </div>
          )}
        </div>
      )}

      {!isMobileSheet && (
        <div className="mb-4 pt-4 border-t border-gray-200 flex items-center justify-between">
          <span className="flex items-center gap-2 font-semibold text-gray-900">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
            Gift Wrap (₹ {giftWrapPrice})
          </span>
          <label className="flex items-center cursor-pointer">
            <input type="checkbox" checked={giftWrapChecked} onChange={(e) => setGiftWrapChecked(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900" />
          </label>
        </div>
      )}

      {!isMobileSheet && (
        <div className="mb-4 pt-4 border-t border-gray-200">
          <button type="button" onClick={() => setTssExpanded(!tssExpanded)} className="flex items-center justify-between w-full text-left">
            <span className="flex items-center gap-2 font-semibold text-gray-900">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              TSS Money / TSS Points
            </span>
            <svg className={`w-5 h-5 text-gray-500 transition-transform ${tssExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {tssExpanded && (
            <div className="mt-3 space-y-3">
              {!isAuthenticated ? (
                <button type="button" onClick={() => openLoginModal("/cart")} className="text-sm text-blue-600 hover:text-blue-700 underline">
                  Login to Apply.
                </button>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      TSS Money
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-100 text-green-700 text-xs font-medium" title="TSS Money can be used for purchases">
                        i
                      </span>
                    </span>
                    <label className="flex items-center cursor-pointer">
                      <input type="checkbox" checked={tssMoneyChecked} onChange={(e) => setTssMoneyChecked(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900" />
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" strokeWidth={2} />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
                      </svg>
                      TSS Points
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-100 text-green-700 text-xs font-medium" title="TSS Points can be redeemed">
                        i
                      </span>
                    </span>
                    <label className="flex items-center cursor-pointer">
                      <input type="checkbox" checked={tssPointsChecked} onChange={(e) => setTssPointsChecked(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900" />
                    </label>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2 mb-4 pt-4 border-t border-gray-200">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span>
          <span className="font-medium text-gray-900">₹{subtotal.toFixed(0)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount ({appliedCoupon?.code})</span>
            <span className="font-medium">−₹{discount.toFixed(0)}</span>
          </div>
        )}
        {giftWrapCharge > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>Gift Wrap</span>
            <span className="font-medium text-gray-900">₹{giftWrapCharge.toFixed(0)}</span>
          </div>
        )}
        {shippingCharge > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>Shipping</span>
            <span className="font-medium text-gray-900">₹{shippingCharge.toFixed(0)}</span>
          </div>
        )}
        {taxTotal > 0 && (
          <>
            {isDelhi ? (
              <>
                <div className="flex justify-between text-gray-600">
                  <span>CGST ({gstRatePercent / 2}%)</span>
                  <span className="font-medium text-gray-900">₹{cgst.toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>SGST ({gstRatePercent / 2}%)</span>
                  <span className="font-medium text-gray-900">₹{sgst.toFixed(0)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-gray-600">
                <span>IGST ({gstRatePercent}%)</span>
                <span className="font-medium text-gray-900">₹{igst.toFixed(0)}</span>
              </div>
            )}
          </>
        )}
        <div className="flex justify-between font-semibold text-gray-900 pt-2 border-t border-gray-100">
          <span>Total</span>
          <span>₹{totalAmount.toFixed(0)}</span>
        </div>
        {paymentMethod === "cod" && checkoutStarted && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
            <p className="text-xs font-semibold text-amber-800 uppercase">Cash on Delivery</p>
            <div className="flex justify-between text-sm text-amber-900">
              <span>{isMobileSheet ? "Due now (advance)" : "Pay now"}</span>
              <span className="font-medium">₹{advanceAmount.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-sm text-amber-900">
              <span>{isMobileSheet ? "Due on delivery" : "Pay on delivery"}</span>
              <span className="font-medium">₹{codRemaining.toLocaleString("en-IN")}</span>
            </div>
          </div>
        )}
      </div>

      {!isMobileSheet ? (
        <>
          <p className="text-xs text-gray-500 mb-4">GST (18%): CGST + SGST for Delhi billing; IGST for other states. Based on address state when you enter it.</p>
          {checkoutStarted ? <p className="text-xs text-gray-500 mb-4">Complete Billing &amp; Shipping in the panel on the left, then use Pay above.</p> : <p className="text-xs text-gray-500 mb-4">Line items, coupons, and full tax breakdown are below.</p>}
        </>
      ) : (
        <p className="text-xs text-gray-500 mb-4">GST (18%): CGST + SGST for Delhi billing; IGST for other states. Based on billing/shipping state.</p>
      )}
    </>
  )

  const checkoutWarning = checkoutStarted && !canPlaceOrder ? <p className="text-xs text-amber-700 rounded-md bg-amber-50 px-2.5 py-2 border border-amber-100">{!billingComplete || !shippingComplete ? "Fill Billing &amp; Shipping above." : "Select a payment method in the Payment section above."}</p> : null

  const checkoutPrimaryButton = checkoutStarted ? (
    <button type="button" onClick={handlePlaceOrder} disabled={!canPlaceOrder || placing} className={`w-full min-h-[48px] px-6 py-3 font-semibold rounded-md uppercase tracking-wide text-sm transition-colors ${canPlaceOrder && !placing ? "bg-gray-900 text-white hover:bg-gray-800" : "bg-gray-200 text-gray-500 cursor-not-allowed"}`}>
      {placing ? "Opening payment..." : !paymentMethod ? "Select payment method" : paymentMethod === "cod" ? `Pay ₹${advanceAmount.toLocaleString("en-IN")}` : "Pay Now"}
    </button>
  ) : (
    <button type="button" onClick={handleProceedToCheckout} className="w-full min-h-[48px] px-6 py-3 bg-gray-900 text-white font-semibold rounded-md hover:bg-gray-800 transition-colors uppercase tracking-wide text-sm">
      Proceed to Checkout
    </button>
  )

  if (isMobileSheet) {
    return (
      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${className}`.trim()}>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(0.5rem,env(safe-area-inset-bottom))]">{scrollBody}</div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="space-y-3 border-b border-gray-200 pb-4">
        <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">Order Summary</h2>
        <div className="flex items-end justify-between gap-3">
          <span className="text-sm font-medium text-gray-600">Total</span>
          <span className="text-2xl font-bold tabular-nums tracking-tight text-gray-900">₹{totalAmount.toLocaleString("en-IN")}</span>
        </div>
        {checkoutWarning}
        <div className="flex flex-col gap-3">
          {checkoutPrimaryButton}
          <Link href="/" className="flex min-h-[48px] w-full items-center justify-center border-2 border-gray-900 px-5 py-3 text-center text-sm font-semibold uppercase tracking-wide text-gray-900 transition-colors hover:bg-gray-50">
            Continue Shopping
          </Link>
        </div>
      </div>
      <div className="pt-4">{scrollBody}</div>
    </div>
  )
}
