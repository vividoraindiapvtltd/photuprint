"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import Script from "next/script"
import { useRouter } from "next/navigation"
import { useCart } from "../../src/context/CartContext"
import { getImageSrc } from "../../src/utils/imageUrl"
import { useAuth } from "../../src/context/AuthContext"
import api from "../../src/utils/api"
import { slugify } from "../../src/utils/slugify"
import TopBar from "../../components/TopBar"
import NavigationBar from "../../components/NavigationBar"
import Footer from "../../components/Footer"

const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js"

const getBaseUrl = () => {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, "")
  }
  return "http://localhost:8080"
}

function resolveImageUrl(url) {
  if (!url) return null
  if (typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"))) return url
  return getBaseUrl() + (url.startsWith("/") ? url : "/" + url)
}

function getCategorySlug(cat) {
  if (cat?.slug && String(cat.slug).trim()) return String(cat.slug).trim().toLowerCase()
  if (cat?.name) return slugify(cat.name)
  return ""
}

const CHECKOUT_STEPS = [
  { key: "bag", label: "MY BAG", href: "/cart" },
  { key: "address", label: "ADDRESS", href: null },
  { key: "payment", label: "PAYMENT", href: null },
]

const PAYMENT_OPTIONS = [
  { id: "cod" }, // label built with pay-now / pay-on-delivery amounts in JSX
  { id: "online", label: "Online Payment (Card, UPI, Net Banking, Wallets)" },
]

/** Flat shipping charge (₹) added to every order. Set to 0 for free shipping. */
const SHIPPING_CHARGE = 99

/** GST rate (%). Company is in Delhi: Delhi billing → CGST+SGST; other states → IGST. */
const GST_RATE_PERCENT = 18

/** Returns true if state is Delhi (company state – intrastate → CGST+SGST). */
function isBillingStateDelhi(state) {
  if (!state || typeof state !== "string") return false
  const s = state.trim().toLowerCase()
  return s === "delhi" || s.includes("national capital") || s.startsWith("nct")
}

const emptyAddress = {
  fullName: "",
  phone: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
}

function Accordion({ title, open, onToggle, children }) {
  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between px-4 py-4 text-left font-semibold text-gray-900 uppercase tracking-wide hover:bg-gray-50 transition-colors">
        <span>{title}</span>
        <svg className={`w-5 h-5 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4 border-t border-gray-100">{children}</div>}
    </div>
  )
}

/* Form field styling aligned with PP-backend brand manager (formLabel, formInput, formError) */
const formLabelClass = "block font-semibold text-gray-700 text-[0.9rem] mb-2"
const formInputClass = "w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 transition-all"
const formErrorClass = "mt-1.5 text-sm text-red-600"

/** Fetch city & state from pincode (same as PP-backend PinCodeManager – api.postalpincode.in) */
async function fetchPincodeDetails(pincode) {
  if (!pincode || String(pincode).trim().length !== 6) return { city: "", state: "" }
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${encodeURIComponent(pincode.trim())}`)
    const data = await res.json()
    if (data?.[0]?.Status === "Success" && data[0].PostOffice?.length > 0) {
      const po = data[0].PostOffice[0]
      return { city: po.District || "", state: po.State || "" }
    }
  } catch (e) {
    console.error("Pincode lookup failed:", e)
  }
  return { city: "", state: "" }
}

function AddressFields({ address, onChange, errors = {}, errorPrefix = "", onPincodeLookup }) {
  const err = (f) => errors[errorPrefix + f]
  const [pincodeLoading, setPincodeLoading] = useState(false)
  const pincodeTimeoutRef = useRef(null)

  const handlePincodeChange = (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 6)
    onChange("pincode", digits)
    if (pincodeTimeoutRef.current) clearTimeout(pincodeTimeoutRef.current)
    if (digits.length !== 6) return
    pincodeTimeoutRef.current = setTimeout(async () => {
      if (!onPincodeLookup) return
      setPincodeLoading(true)
      try {
        const result = await onPincodeLookup(digits)
        if (result?.city != null) onChange("city", result.city)
        if (result?.state != null) onChange("state", result.state)
      } finally {
        setPincodeLoading(false)
      }
    }, 500)
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4 pt-4">
      <div className="sm:col-span-2">
        <label className={formLabelClass}>
          Full name <span className="text-red-500">*</span>
        </label>
        <input type="text" value={address.fullName} onChange={(e) => onChange("fullName", e.target.value)} className={formInputClass} placeholder="Your name" />
        {err("fullName") && <p className={formErrorClass}>{err("fullName")}</p>}
      </div>
      <div>
        <label className={formLabelClass}>
          Phone <span className="text-red-500">*</span>
        </label>
        <input type="tel" value={address.phone} onChange={(e) => onChange("phone", e.target.value)} className={formInputClass} placeholder="10-digit mobile" />
        {err("phone") && <p className={formErrorClass}>{err("phone")}</p>}
      </div>
      <div>
        <label className={formLabelClass}>
          Email <span className="text-red-500">*</span>
        </label>
        <input type="email" value={address.email} onChange={(e) => onChange("email", e.target.value)} className={formInputClass} placeholder="email@example.com" />
        {err("email") && <p className={formErrorClass}>{err("email")}</p>}
      </div>
      <div className="sm:col-span-2">
        <label className={formLabelClass}>
          Address line 1 <span className="text-red-500">*</span>
        </label>
        <input type="text" value={address.addressLine1} onChange={(e) => onChange("addressLine1", e.target.value)} className={formInputClass} placeholder="Street, area, landmark" />
        {err("addressLine1") && <p className={formErrorClass}>{err("addressLine1")}</p>}
      </div>
      <div className="sm:col-span-2">
        <label className={formLabelClass}>Address line 2 (optional)</label>
        <input type="text" value={address.addressLine2} onChange={(e) => onChange("addressLine2", e.target.value)} className={formInputClass} placeholder="Apartment, floor, etc." />
      </div>
      <div>
        <label className={formLabelClass}>
          Pincode <span className="text-red-500">*</span>
        </label>
        <input type="text" value={address.pincode} onChange={(e) => handlePincodeChange(e.target.value)} className={formInputClass} placeholder="6-digit (city & state auto-fill)" maxLength={6} />
        {pincodeLoading && <p className="mt-1.5 text-sm text-gray-500">Fetching details...</p>}
        {err("pincode") && <p className={formErrorClass}>{err("pincode")}</p>}
      </div>
      <div>
        <label className={formLabelClass}>
          City <span className="text-red-500">*</span>
        </label>
        <input type="text" value={address.city} onChange={(e) => onChange("city", e.target.value)} className={formInputClass} placeholder="Auto-filled from pincode" />
        {err("city") && <p className={formErrorClass}>{err("city")}</p>}
      </div>
      <div>
        <label className={formLabelClass}>
          State <span className="text-red-500">*</span>
        </label>
        <input type="text" value={address.state} onChange={(e) => onChange("state", e.target.value)} className={formInputClass} placeholder="Auto-filled from pincode" />
        {err("state") && <p className={formErrorClass}>{err("state")}</p>}
      </div>
      <div>
        <label className={formLabelClass}>
          Country <span className="text-red-500">*</span>
        </label>
        <input type="text" value={address.country} onChange={(e) => onChange("country", e.target.value)} className={formInputClass} placeholder="e.g. India" />
        {err("country") && <p className={formErrorClass}>{err("country")}</p>}
      </div>
    </div>
  )
}

export default function CartPage() {
  const router = useRouter()
  const { items, totalCount, removeItem, updateQuantity, clearCart } = useCart()
  const { isAuthenticated, openLoginModal, user } = useAuth()
  const [categories, setCategories] = useState([])
  const [coupons, setCoupons] = useState([])
  const [couponsLoading, setCouponsLoading] = useState(true)
  const [couponCode, setCouponCode] = useState("")
  const [appliedCoupon, setAppliedCoupon] = useState(false)
  const [couponError, setCouponError] = useState("")
  const [giftVoucherExpanded, setGiftVoucherExpanded] = useState(true)
  const [giftVoucherCode, setGiftVoucherCode] = useState("")
  const [giftWrapChecked, setGiftWrapChecked] = useState(false)
  const [tssExpanded, setTssExpanded] = useState(true)
  const [tssMoneyChecked, setTssMoneyChecked] = useState(false)
  const [tssPointsChecked, setTssPointsChecked] = useState(false)
  const GIFT_WRAP_PRICE = 25
  const [openAccordion, setOpenAccordion] = useState("bag")
  const [billingAddress, setBillingAddress] = useState(emptyAddress)
  const [shippingAddress, setShippingAddress] = useState(emptyAddress)
  const [sameAsBilling, setSameAsBilling] = useState(true)
  const [paymentMethod, setPaymentMethod] = useState(null)
  const [placing, setPlacing] = useState(false)
  const [errors, setErrors] = useState({})
  const hasAutoOpenedPayment = useRef(false)
  const [checkoutStarted, setCheckoutStarted] = useState(false)
  const [razorpayReady, setRazorpayReady] = useState(false)

  useEffect(() => {
    api
      .get("/categories?showInactive=false&includeDeleted=false", { skipAuth: true })
      .then((res) => {
        const data = res?.data ?? res
        setCategories(Array.isArray(data) ? data.slice(0, 8) : [])
      })
      .catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    api
      .get("/coupons?showInactive=false&includeDeleted=false", { skipAuth: true })
      .then((res) => {
        const raw = res?.data ?? res
        const list = Array.isArray(raw) ? raw : (raw?.coupons ?? [])
        setCoupons(list)
      })
      .catch(() => setCoupons([]))
      .finally(() => setCouponsLoading(false))
  }, [])

  // Fetch profile when logged in and pre-fill billing/shipping from saved address
  useEffect(() => {
    if (!isAuthenticated) return
    api
      .get("/users/profile")
      .then((res) => {
        const profile = res?.data ?? res
        if (!profile || (profile.user === null && !profile._id)) return
        const p = profile._id ? profile : profile.user || profile
        if (!p) return
        const street = p.address?.street || ""
        const streetParts = street
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
        setBillingAddress((prev) => ({
          ...prev,
          fullName: p.name ?? prev.fullName,
          email: p.email ?? prev.email,
          phone: p.phone ?? prev.phone,
          addressLine1: streetParts[0] ?? prev.addressLine1,
          addressLine2: streetParts.slice(1).join(", ") ?? prev.addressLine2,
          city: p.address?.city ?? prev.city,
          state: p.address?.state ?? prev.state,
          pincode: p.address?.zipCode ?? prev.pincode,
          country: p.address?.country ?? prev.country,
        }))
      })
      .catch(() => {})
  }, [isAuthenticated])

  useEffect(() => {
    if (sameAsBilling) setShippingAddress({ ...billingAddress })
  }, [sameAsBilling, billingAddress])

  const toggleAccordion = (key) => {
    setOpenAccordion((prev) => (prev === key ? null : key))
  }

  const handleProceedToCheckout = () => {
    if (!isAuthenticated) {
      openLoginModal("/cart")
      return
    }
    setCheckoutStarted(true)
    setOpenAccordion("billing")
    const u = user?.user
    if (u) {
      setBillingAddress((prev) => ({
        ...prev,
        fullName: u.name ?? prev.fullName,
        email: u.email ?? prev.email,
        phone: u.phone ?? prev.phone,
        addressLine1: u.addressLine1 ?? u.address ?? prev.addressLine1,
        addressLine2: u.addressLine2 ?? prev.addressLine2,
        city: u.city ?? prev.city,
        state: u.state ?? prev.state,
        pincode: u.pincode ?? prev.pincode,
        country: u.country ?? prev.country,
      }))
    }
  }

  const setBillingField = (field, value) => {
    setBillingAddress((a) => ({ ...a, [field]: value }))
    if (errors["billing_" + field]) setErrors((e) => ({ ...e, ["billing_" + field]: null }))
  }
  const setShippingField = (field, value) => {
    setShippingAddress((a) => ({ ...a, [field]: value }))
    if (errors["shipping_" + field]) setErrors((e) => ({ ...e, ["shipping_" + field]: null }))
  }

  const subtotal = items.reduce((sum, x) => {
    const p = x.discountedPrice != null ? x.discountedPrice : x.price
    return sum + p * (x.quantity || 0)
  }, 0)

  const cartProductIds = items.map((x) => String(x.productId || "")).filter(Boolean)
  const isCouponApplicableToCart = (coupon) => {
    const productIds = coupon?.applicableProductIds
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) return true
    return productIds.some((pid) => cartProductIds.includes(String(pid)))
  }
  const isListableCoupon = (coupon) => {
    const isBankOffer = coupon?.isBankOffer === true
    const hasApplicableProductIds = coupon?.applicableProductIds && Array.isArray(coupon.applicableProductIds) && coupon.applicableProductIds.length > 0
    return isBankOffer || hasApplicableProductIds
  }
  const availableCoupons = coupons.filter((c) => isListableCoupon(c) && isCouponApplicableToCart(c))

  // Coupon applies to single product, single quantity only — eligible amount = unit price of one product
  const validateAndComputeCoupon = (coupon, subTotal, cartItems = items) => {
    if (!coupon) return { valid: false, discount: 0, error: "Invalid coupon." }
    if (coupon.isActive === false || coupon.deleted === true) return { valid: false, discount: 0, error: "This coupon is no longer valid." }
    const now = new Date()
    if (coupon.startDate && new Date(coupon.startDate) > now) return { valid: false, discount: 0, error: "This coupon is not yet active." }
    if (coupon.expiryDate && new Date(coupon.expiryDate) < now) return { valid: false, discount: 0, error: "This coupon has expired." }
    if (coupon.usageType === "single" && coupon.used === true) return { valid: false, discount: 0, error: "This coupon has already been used." }
    const productIds = coupon?.applicableProductIds
    const isProductSpecific = productIds && Array.isArray(productIds) && productIds.length > 0
    let candidateItems = cartItems
    if (isProductSpecific) {
      candidateItems = cartItems.filter((x) => productIds.some((pid) => String(pid) === String(x.productId)))
      if (candidateItems.length === 0) return { valid: false, discount: 0, error: "Add applicable product(s) to use this coupon." }
    }
    const unitPrice = (x) => (x.discountedPrice != null ? x.discountedPrice : x.price) || 0
    const singleProductUnitPrice = candidateItems.length === 0 ? 0 : Math.max(...candidateItems.map(unitPrice))
    const eligibleSubtotal = singleProductUnitPrice
    if (eligibleSubtotal <= 0) return { valid: false, discount: 0, error: "Invalid coupon." }
    const min = Number(coupon.minPurchase) || 0
    if (subTotal < min) return { valid: false, discount: 0, error: `Minimum purchase of ₹${min.toFixed(0)} required.` }
    const dt = coupon.discountType || "percentage"
    const dv = Number(coupon.discountValue) || 0
    let discount = 0
    if (dt === "percentage") discount = Math.min(eligibleSubtotal * (dv / 100), eligibleSubtotal)
    else discount = Math.min(dv, eligibleSubtotal)
    discount = Math.round(discount)
    return { valid: true, discount, error: null }
  }

  const isAddressComplete = (addr) => !!(addr.fullName?.trim() && addr.phone?.trim() && addr.email?.trim() && addr.addressLine1?.trim() && addr.city?.trim() && addr.state?.trim() && addr.pincode?.trim() && addr.country?.trim())
  const billingComplete = isAddressComplete(billingAddress)
  const shippingComplete = sameAsBilling ? billingComplete : isAddressComplete(shippingAddress)
  const canPlaceOrder = billingComplete && shippingComplete && !!paymentMethod

  const validate = () => {
    const e = {}
    if (!billingAddress.fullName?.trim()) e.billing_fullName = "Required"
    if (!billingAddress.phone?.trim()) e.billing_phone = "Required"
    if (!billingAddress.email?.trim()) e.billing_email = "Required"
    if (!billingAddress.addressLine1?.trim()) e.billing_addressLine1 = "Required"
    if (!billingAddress.city?.trim()) e.billing_city = "Required"
    if (!billingAddress.state?.trim()) e.billing_state = "Required"
    if (!billingAddress.pincode?.trim()) e.billing_pincode = "Required"
    if (!billingAddress.country?.trim()) e.billing_country = "Required"
    if (!sameAsBilling) {
      if (!shippingAddress.fullName?.trim()) e.shipping_fullName = "Required"
      if (!shippingAddress.phone?.trim()) e.shipping_phone = "Required"
      if (!shippingAddress.email?.trim()) e.shipping_email = "Required"
      if (!shippingAddress.addressLine1?.trim()) e.shipping_addressLine1 = "Required"
      if (!shippingAddress.city?.trim()) e.shipping_city = "Required"
      if (!shippingAddress.state?.trim()) e.shipping_state = "Required"
      if (!shippingAddress.pincode?.trim()) e.shipping_pincode = "Required"
      if (!shippingAddress.country?.trim()) e.shipping_country = "Required"
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const mapAddressToBackend = (addr) => ({
    name: addr.fullName?.trim() || "",
    phone: addr.phone?.trim() || "",
    email: addr.email?.trim() || "",
    street: [addr.addressLine1?.trim(), addr.addressLine2?.trim()].filter(Boolean).join(", ") || "",
    city: addr.city?.trim() || "",
    state: addr.state?.trim() || "",
    zipCode: addr.pincode?.trim() || "",
    country: addr.country?.trim() || "",
  })

  const mapPaymentMethodToBackend = (method) => {
    const map = { cod: "cash_on_delivery", online: "credit_card" }
    return map[method] || "credit_card"
  }

  const buildOrderData = () => {
    const shippingAddr = mapAddressToBackend(shippingAddress)
    const billingAddr = sameAsBilling ? shippingAddr : mapAddressToBackend(billingAddress)
    const orderProducts = items.map((item) => {
      const price = item.discountedPrice != null ? item.discountedPrice : item.price
      return {
        product: item.productId,
        productName: item.name,
        productImage: item.image || null,
        quantity: item.quantity || 1,
        price: Number(price) || 0,
      }
    })
    const subtotalAmount = items.reduce((sum, x) => {
      const p = x.discountedPrice != null ? x.discountedPrice : x.price
      return sum + p * (x.quantity || 0)
    }, 0)
    const shippingCharges = SHIPPING_CHARGE
    const discountRes = appliedCoupon ? validateAndComputeCoupon(appliedCoupon, subtotalAmount) : null
    const discount = discountRes?.valid ? discountRes.discount : 0
    const giftWrapChargeOrder = giftWrapChecked ? GIFT_WRAP_PRICE : 0
    const taxableValueOrder = Math.max(0, subtotalAmount - discount + giftWrapChargeOrder + shippingCharges)
    const billingState = (sameAsBilling ? shippingAddress?.state : billingAddress?.state) || ""
    const isDelhiOrder = isBillingStateDelhi(billingState)
    let cgstOrder = 0,
      sgstOrder = 0,
      igstOrder = 0
    if (taxableValueOrder > 0) {
      if (isDelhiOrder) {
        cgstOrder = Math.round((taxableValueOrder * (GST_RATE_PERCENT / 2)) / 100)
        sgstOrder = Math.round((taxableValueOrder * (GST_RATE_PERCENT / 2)) / 100)
      } else {
        igstOrder = Math.round((taxableValueOrder * GST_RATE_PERCENT) / 100)
      }
    }
    const tax = cgstOrder + sgstOrder + igstOrder
    const totalAmount = Math.max(0, Math.round(taxableValueOrder + tax))
    return {
      products: orderProducts,
      subtotal: subtotalAmount,
      tax,
      cgst: cgstOrder,
      sgst: sgstOrder,
      igst: igstOrder,
      shippingCharges,
      discount,
      giftWrap: giftWrapChecked,
      giftWrapCharge: giftWrapChargeOrder,
      giftVoucherCode: giftVoucherCode?.trim() || undefined,
      tssMoney: tssMoneyChecked,
      tssPoints: tssPointsChecked,
      couponCode: appliedCoupon?.code || couponCode?.trim() || undefined,
      couponId: appliedCoupon?._id || appliedCoupon?.id || undefined,
      shippingAddress: shippingAddr,
      billingAddress: billingAddr,
      paymentMethod: mapPaymentMethodToBackend(paymentMethod),
      isCodAdvance: paymentMethod === "cod",
    }
  }

  const handlePaymentSuccess = async (razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
    try {
      const orderData = buildOrderData()
      const res = await api.post("/verify-payment", {
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,
        orderData,
      })
      const order = res?.data ?? res
      const orderId = order?.orderNumber || order?._id || order?.id
      if (!orderId) {
        throw new Error("Invalid order response")
      }
      clearCart()
      const shippingAddr = mapAddressToBackend(shippingAddress)
      try {
        await api.put("/users/profile", {
          name: shippingAddr.name,
          phone: shippingAddr.phone,
          address: {
            street: shippingAddr.street,
            city: shippingAddr.city,
            state: shippingAddr.state,
            zipCode: shippingAddr.zipCode,
            country: shippingAddr.country,
          },
        })
      } catch {
        /* non-blocking */
      }
      router.push(`/thankyou?orderId=${encodeURIComponent(String(orderId))}`)
    } catch (err) {
      const code = err?.response?.data?.code
      const msg = err?.response?.data?.msg || err?.message || "Payment verification failed. Please contact support if amount was deducted."
      setErrors({ form: code === "INVALID_SIGNATURE" ? "Payment verification failed. Please contact support." : msg })
      setPlacing(false)
    }
  }

  const openRazorpayCheckout = async () => {
    if (items.length === 0) return
    if (!paymentMethod) return
    if (!isAuthenticated) {
      openLoginModal("/cart")
      return
    }
    if (!validate()) return

    setPlacing(true)
    setErrors({})
    if (typeof window === "undefined" || !window.Razorpay) {
      setErrors({ form: razorpayReady ? "Payment gateway failed to load. Please try again." : "Payment gateway is loading. Please try again in a moment." })
      setPlacing(false)
      return
    }

    try {
      const orderData = buildOrderData()
      const totalAmount = orderData.subtotal + orderData.tax + orderData.shippingCharges - orderData.discount + (orderData.giftWrapCharge || 0)
      const isCod = paymentMethod === "cod"
      const payAmount = isCod ? Math.round(totalAmount * 0.4) : totalAmount

      const createRes = await api.post("/create-order", {
        amount: payAmount,
        currency: "INR",
        isCodAdvance: isCod,
        orderData,
      })
      const { orderId, key, amount } = createRes?.data ?? createRes
      if (!orderId || !key) {
        throw new Error(createRes?.msg || "Failed to create payment order")
      }

      const options = {
        key,
        amount,
        currency: "INR",
        name: "PhotuPrint",
        description: isCod ? "COD advance payment" : "Order Payment",
        order_id: orderId,
        prefill: {
          name: shippingAddress?.fullName || billingAddress?.fullName || "",
          email: shippingAddress?.email || billingAddress?.email || "",
          contact: shippingAddress?.phone || billingAddress?.phone || "",
        },
        theme: { color: "#111827" },
        handler: (response) => {
          handlePaymentSuccess(response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature)
        },
        modal: {
          ondismiss: () => {
            setPlacing(false)
            router.push("/thankyou?status=cancelled")
          },
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.on("payment.failed", (response) => {
        setPlacing(false)
        router.push(`/thankyou?status=failed&reason=${encodeURIComponent(response.error?.description || "Payment failed")}`)
      })
      rzp.open()
    } catch (err) {
      const code = err?.response?.data?.code
      const msg = err?.response?.data?.msg || err?.message || "Failed to initiate payment. Please try again."
      setErrors({
        form: code === "PAYMENT_NOT_CONFIGURED" ? "Payment gateway is not configured. Please contact support." : code === "AMOUNT_MISMATCH" ? "Cart has changed. Please refresh and try again." : msg,
      })
      setPlacing(false)
    }
  }

  const handlePlaceOrder = () => {
    openRazorpayCheckout()
  }

  const handleApplyCoupon = (e, couponFromList) => {
    if (e && e.preventDefault) e.preventDefault()
    setCouponError("")
    const coupon = couponFromList || coupons.find((c) => (c.code || "").toUpperCase() === (couponCode || "").trim().toUpperCase())
    if (!coupon) {
      setCouponError("Invalid or expired coupon.")
      return
    }
    const result = validateAndComputeCoupon(coupon, subtotal)
    if (!result.valid) {
      setCouponError(result.error || "Invalid or expired coupon.")
      return
    }
    setAppliedCoupon({ ...coupon, computedDiscount: result.discount })
    setCouponCode(coupon.code || "")
    setCouponError("")
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode("")
    setCouponError("")
  }

  const discountResult = appliedCoupon ? validateAndComputeCoupon(appliedCoupon, subtotal) : null
  const discount = discountResult?.valid ? discountResult.discount : 0
  const giftWrapCharge = giftWrapChecked ? GIFT_WRAP_PRICE : 0
  const shippingCharge = SHIPPING_CHARGE
  const taxableValue = Math.max(0, subtotal - discount + giftWrapCharge + shippingCharge)
  const isDelhi = isBillingStateDelhi(billingAddress?.state)
  let cgst = 0,
    sgst = 0,
    igst = 0
  if (billingComplete && taxableValue > 0) {
    if (isDelhi) {
      cgst = Math.round((taxableValue * (GST_RATE_PERCENT / 2)) / 100)
      sgst = Math.round((taxableValue * (GST_RATE_PERCENT / 2)) / 100)
    } else {
      igst = Math.round((taxableValue * GST_RATE_PERCENT) / 100)
    }
  }
  const taxTotal = cgst + sgst + igst
  const totalAmount = Math.max(0, Math.round(taxableValue + taxTotal))

  useEffect(() => {
    if (!appliedCoupon || subtotal <= 0) return
    const res = validateAndComputeCoupon(appliedCoupon, subtotal)
    if (!res.valid) {
      setAppliedCoupon(null)
      setCouponCode("")
      setCouponError(res.error || "Coupon no longer applicable.")
    }
  }, [subtotal, appliedCoupon])

  // When user has started checkout and billing & shipping are complete, open Payment accordion once (don't run on initial load so My Bag stays default open)
  useEffect(() => {
    if (checkoutStarted && billingComplete && shippingComplete && !hasAutoOpenedPayment.current) {
      hasAutoOpenedPayment.current = true
      setOpenAccordion("payment")
    }
  }, [checkoutStarted, billingComplete, shippingComplete])

  const codAdvanceAmount = Math.round(totalAmount * 0.4)
  const advanceAmount = paymentMethod === "cod" ? codAdvanceAmount : 0
  const codRemaining = paymentMethod === "cod" ? totalAmount - advanceAmount : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <Script src={RAZORPAY_SCRIPT_URL} strategy="lazyOnload" onLoad={() => setRazorpayReady(true)} />
      <header className="sticky top-0 z-50 w-full">
        <TopBar />
        <NavigationBar />
      </header>

      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Step indicator (like The Souled Store: MY BAG → ADDRESS → PAYMENT) */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-8 text-xs sm:text-sm uppercase tracking-widest text-gray-500">
          {CHECKOUT_STEPS.map((step, i) => (
            <span key={step.key} className="flex items-center gap-2 sm:gap-4">
              <span className={i === 0 ? "font-semibold text-gray-900" : ""}>{step.label}</span>
              {i < CHECKOUT_STEPS.length - 1 && <span className="text-gray-300">–</span>}
            </span>
          ))}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 uppercase tracking-wide mb-2">My Bag</h1>
        <p className="text-gray-600 text-sm mb-8">{totalCount === 0 ? "Your bag is empty" : `${totalCount} item${totalCount !== 1 ? "s" : ""} in your bag`}</p>

        {items.length === 0 ? (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-10 sm:p-14 text-center">
              <p className="text-gray-700 text-lg mb-8">Your shopping bag is empty. Please add something soon—bags have feelings too.</p>

              {/* Popular Categories - like The Souled Store */}
              {categories.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">Popular Categories</h2>
                  <div className="flex flex-wrap justify-center gap-3">
                    {categories.map((cat) => (
                      <Link key={cat._id || cat.id} href={getCategorySlug(cat) ? `/${getCategorySlug(cat)}` : "/products"} className="px-4 py-2 rounded-full border border-gray-300 text-gray-700 text-sm hover:border-gray-900 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                        {cat.name || "Shop"}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/" className="inline-flex items-center justify-center px-8 py-3 bg-gray-900 text-white font-semibold rounded-md hover:bg-gray-800 transition-colors uppercase tracking-wide text-sm">
                  Continue Shopping
                </Link>
                {!isAuthenticated && (
                  <button type="button" onClick={() => openLoginModal("/cart")} className="inline-flex items-center justify-center px-8 py-3 border-2 border-gray-900 text-gray-900 font-semibold rounded-md hover:bg-gray-50 transition-colors uppercase tracking-wide text-sm">
                    Login
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Accordions: My Bag, Billing address, Shipping address, Payment */}
            <div className="flex-1 space-y-4">
              <Accordion title={`My Bag (${totalCount} item${totalCount !== 1 ? "s" : ""})`} open={openAccordion === "bag"} onToggle={() => toggleAccordion("bag")}>
                <ul className="divide-y divide-gray-200 overflow-hidden pt-4">
                  {items.map((item) => {
                    const imgSrc = item.customDesign?.image || item.image
                    const src = imgSrc ? resolveImageUrl(imgSrc) : null
                    const price = item.discountedPrice != null ? item.discountedPrice : item.price
                    const lineTotal = price * (item.quantity || 0)
                    return (
                      <li key={item.lineId} className="flex gap-4 sm:gap-6 py-4 first:pt-0">
                        <div className="relative flex-shrink-0 w-[151px] h-[202px] bg-gray-100 rounded-lg overflow-hidden">{src ? <Image src={getImageSrc(src) || src} alt={item.name} width={151} height={202} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No image</div>}</div>
                        <div className="flex-1 min-w-0">
                          <Link href={item.slug ? `/products/${item.slug}` : "#"} className="font-semibold text-gray-900 hover:text-gray-600 line-clamp-2">
                            {item.name}
                          </Link>
                          {item.customDesign && <span className="inline-block mt-1 text-xs text-green-600 font-medium">Customized</span>}
                          {item.variant?.name && <p className="text-sm text-gray-500 mt-0.5">{item.variant.name}</p>}
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
                              <button type="button" onClick={() => updateQuantity(item.lineId, (item.quantity || 1) - 1)} className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 transition-colors">
                                −
                              </button>
                              <span className="px-3 py-1.5 text-sm border-x border-gray-300 min-w-[2.5rem] text-center bg-white">{item.quantity}</span>
                              <button type="button" onClick={() => updateQuantity(item.lineId, (item.quantity || 1) + 1)} className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 transition-colors">
                                +
                              </button>
                            </div>
                            <button type="button" onClick={() => removeItem(item.lineId)} className="text-sm text-gray-500 hover:text-red-600 underline underline-offset-2">
                              Remove
                            </button>
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="font-semibold text-gray-900">₹{lineTotal.toFixed(0)}</p>
                          {item.discountedPrice != null && item.discountedPrice < item.price && <p className="text-xs text-gray-500 line-through">₹{(item.price * (item.quantity || 0)).toFixed(0)}</p>}
                        </div>
                      </li>
                    )
                  })}
                </ul>
                <div className="pt-2">
                  <Link href="/" className="inline-flex items-center text-gray-600 hover:text-gray-900 font-medium text-sm">
                    ← Continue Shopping
                  </Link>
                </div>
              </Accordion>
              {checkoutStarted && (
                <>
                  <Accordion title="Billing address" open={openAccordion === "billing"} onToggle={() => toggleAccordion("billing")}>
                    <AddressFields address={billingAddress} onChange={setBillingField} errors={errors} errorPrefix="billing_" onPincodeLookup={fetchPincodeDetails} />
                  </Accordion>
                  <Accordion title="Shipping address" open={openAccordion === "shipping"} onToggle={() => toggleAccordion("shipping")}>
                    <label className="flex items-center gap-2 pt-4 cursor-pointer">
                      <input type="checkbox" checked={sameAsBilling} onChange={(e) => setSameAsBilling(e.target.checked)} className="rounded border-gray-300 text-gray-900 focus:ring-gray-900" />
                      <span className="text-sm text-gray-700">Same as billing address</span>
                    </label>
                    {!sameAsBilling && <AddressFields address={shippingAddress} onChange={setShippingField} errors={errors} errorPrefix="shipping_" onPincodeLookup={fetchPincodeDetails} />}
                  </Accordion>
                  <Accordion title="Payment" open={openAccordion === "payment"} onToggle={() => toggleAccordion("payment")}>
                    <div className="space-y-2 pt-4">
                      {PAYMENT_OPTIONS.map((opt) => (
                        <label key={opt.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                          <input type="radio" name="payment" value={opt.id} checked={paymentMethod === opt.id} onChange={() => setPaymentMethod(opt.id)} className="text-gray-900 focus:ring-gray-900" />
                          <span className="text-sm font-medium text-gray-900">{opt.id === "cod" ? `Cash on Delivery (COD) — Pay ₹${codAdvanceAmount.toLocaleString("en-IN")} now, ₹${(totalAmount - codAdvanceAmount).toLocaleString("en-IN")} on delivery` : opt.label}</span>
                        </label>
                      ))}
                    </div>
                    {(!billingComplete || !shippingComplete) && <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Fill Billing address and Shipping address above to enable Place Order.</p>}
                    {billingComplete && shippingComplete && !paymentMethod && <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Select a payment method above to place your order.</p>}
                    {errors.form && <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errors.form}</p>}
                    <button type="button" onClick={handlePlaceOrder} disabled={!canPlaceOrder || placing} className={`w-full mt-4 px-6 py-3.5 font-semibold rounded-md uppercase tracking-wide text-sm transition-colors ${canPlaceOrder && !placing ? "bg-gray-900 text-white hover:bg-gray-800" : "bg-gray-200 text-gray-500 cursor-not-allowed"}`}>
                      {placing ? "Opening payment..." : !paymentMethod ? "Select payment method" : paymentMethod === "cod" ? `Pay ₹${advanceAmount.toLocaleString("en-IN")}` : "Pay Now"}
                    </button>
                  </Accordion>
                </>
              )}
            </div>

            {/* Order summary - ADDRESS / PAYMENT style block */}
            <aside className="lg:w-96 flex-shrink-0">
              <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-24">
                <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide mb-4">Order Summary</h2>
                <ul className="divide-y divide-gray-200 mb-4 max-h-60 overflow-y-auto">
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

                {/* Coupons - apply before totals */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Available Coupons</label>
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
                    <p className="text-xs text-gray-500 mb-3">{coupons.length > 0 ? "No bank or product-specific coupons apply. Enter your code below to apply a coupon." : "No coupons available."}</p>
                  )}

                  <form onSubmit={handleApplyCoupon} className="mt-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Have a code?</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter code"
                        value={couponCode}
                        onChange={(e) => {
                          setCouponCode(e.target.value)
                          setCouponError("")
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                      />
                      <button type="submit" className="px-4 py-2 border border-gray-900 text-gray-900 font-medium rounded-md text-sm hover:bg-gray-50 transition-colors">
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

                {/* Gift Voucher */}
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

                {/* Gift Wrap */}
                <div className="mb-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                  <span className="flex items-center gap-2 font-semibold text-gray-900">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                    </svg>
                    Gift Wrap (₹ {GIFT_WRAP_PRICE})
                  </span>
                  <label className="flex items-center cursor-pointer">
                    <input type="checkbox" checked={giftWrapChecked} onChange={(e) => setGiftWrapChecked(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900" />
                  </label>
                </div>

                {/* TSS Money / TSS Points */}
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

                {/* Order breakdown: Subtotal → Discount → Total → COD pay-now / on-delivery */}
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
                            <span>CGST ({GST_RATE_PERCENT / 2}%)</span>
                            <span className="font-medium text-gray-900">₹{cgst.toFixed(0)}</span>
                          </div>
                          <div className="flex justify-between text-gray-600">
                            <span>SGST ({GST_RATE_PERCENT / 2}%)</span>
                            <span className="font-medium text-gray-900">₹{sgst.toFixed(0)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between text-gray-600">
                          <span>IGST ({GST_RATE_PERCENT}%)</span>
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
                        <span>Pay now</span>
                        <span className="font-medium">₹{advanceAmount.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex justify-between text-sm text-amber-900">
                        <span>Pay on delivery</span>
                        <span className="font-medium">₹{codRemaining.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-500 mb-4">Shipping and taxes calculated at checkout.</p>

                {checkoutStarted ? <p className="text-xs text-gray-500 mb-4">Complete Billing &amp; Shipping above, then place your order.</p> : <p className="text-xs text-gray-500 mb-4">Click Proceed to Checkout to enter delivery details and payment.</p>}

                <div className="space-y-3">
                  {checkoutStarted && !canPlaceOrder && <p className="text-xs text-amber-700">{!billingComplete || !shippingComplete ? "Fill Billing &amp; Shipping above." : "Select a payment method in the Payment section above."}</p>}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link href="/" className="flex-1 text-center px-6 py-3 border-2 border-gray-900 text-gray-900 font-semibold rounded-md hover:bg-gray-50 transition-colors uppercase tracking-wide text-sm">
                      Continue Shopping
                    </Link>
                    {checkoutStarted ? (
                      <button type="button" onClick={handlePlaceOrder} disabled={!canPlaceOrder || placing} className={`flex-1 px-6 py-3 font-semibold rounded-md uppercase tracking-wide text-sm transition-colors ${canPlaceOrder && !placing ? "bg-gray-900 text-white hover:bg-gray-800" : "bg-gray-200 text-gray-500 cursor-not-allowed"}`}>
                        {placing ? "Opening payment..." : !paymentMethod ? "Select payment method" : paymentMethod === "cod" ? `Pay ₹${advanceAmount.toLocaleString("en-IN")}` : "Pay Now"}
                      </button>
                    ) : (
                      <button type="button" onClick={handleProceedToCheckout} className="flex-1 px-6 py-3 bg-gray-900 text-white font-semibold rounded-md hover:bg-gray-800 transition-colors uppercase tracking-wide text-sm">
                        Proceed to Checkout
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
