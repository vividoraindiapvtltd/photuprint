"use client"

import { useEffect, useState, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { useAuth } from "../../src/context/AuthContext"
import Header from "../../src/components/Header"
import api from "../../src/utils/api"
import { getProductSlug } from "../../src/utils/slugify"
import { getImageSrc } from "../../src/utils/imageUrl"

// Tab Components
function ProfileTab({ profile, onUpdate, loading }) {
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    dateOfBirth: "",
    gender: "",
    emailNotifications: true,
    smsNotifications: false,
    promotionalEmails: true,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        mobile: profile.phone || profile.mobile || "",
        dateOfBirth: profile.dateOfBirth ? new Date(profile.dateOfBirth).toISOString().split("T")[0] : "",
        gender: profile.gender || "",
        emailNotifications: profile.emailNotifications ?? true,
        smsNotifications: profile.smsNotifications ?? false,
        promotionalEmails: profile.promotionalEmails ?? true,
      })
    }
  }, [profile])

  const handleSave = async () => {
    setSaving(true)
    try {
      const name = formData.name?.trim() || profile?.name || ""
      const phone = formData.mobile?.trim() || null
      if (!name) {
        alert("Name is required")
        setSaving(false)
        return
      }
      await api.put("/users/profile", { name, phone })
      await onUpdate()
      setEditing(false)
    } catch (error) {
      console.error("Error updating profile:", error)
      alert(error?.response?.data?.msg || "Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Your Account</h2>
        {!editing && (
          <button onClick={() => setEditing(true)} className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors">
            Edit Profile
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
        {/* Personal Information */}
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Full Name</label>
              {editing ? <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" /> : <p className="text-gray-900">{profile?.name || "-"}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
              <p className="text-gray-900">{profile?.email || "-"}</p>
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Mobile Number</label>
              {editing ? <input type="tel" value={formData.mobile} onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="10-digit mobile number" /> : <p className="text-gray-900">{profile?.phone || profile?.mobile || "-"}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Date of Birth</label>
              {editing ? <input type="date" value={formData.dateOfBirth} onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" /> : <p className="text-gray-900" suppressHydrationWarning>{profile?.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString("en-IN") : "-"}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Gender</label>
              {editing ? (
                <select value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              ) : (
                <p className="text-gray-900 capitalize">{profile?.gender?.replace(/_/g, " ") || "-"}</p>
              )}
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h3>
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-gray-700">Email Notifications</span>
              <input type="checkbox" checked={formData.emailNotifications} onChange={(e) => setFormData({ ...formData, emailNotifications: e.target.checked })} disabled={!editing} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50" />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-gray-700">SMS Notifications</span>
              <input type="checkbox" checked={formData.smsNotifications} onChange={(e) => setFormData({ ...formData, smsNotifications: e.target.checked })} disabled={!editing} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50" />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-gray-700">Promotional Emails</span>
              <input type="checkbox" checked={formData.promotionalEmails} onChange={(e) => setFormData({ ...formData, promotionalEmails: e.target.checked })} disabled={!editing} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50" />
            </label>
          </div>
        </div>

        {/* Edit Actions */}
        {editing && (
          <div className="p-6 bg-gray-50 flex justify-end space-x-3">
            <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>

      {/* Shipping & Billing Address (single address saved via profile) */}
      <AddressSection profile={profile} onUpdate={onUpdate} />
    </div>
  )
}

// Single shipping & billing address saved via PUT /users/profile (backend has one address object)
function AddressSection({ profile, onUpdate }) {
  const addr = profile?.address || {}
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pincode: "",
    country: "",
    phone: "",
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const a = profile?.address || {}
    const street = a.street || ""
    const parts = street
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    setFormData({
      addressLine1: parts[0] || "",
      addressLine2: parts.slice(1).join(", ") || "",
      city: a.city || "",
      state: a.state || "",
      pincode: a.zipCode || "",
      country: a.country || "",
      phone: profile?.phone || "",
    })
  }, [profile])

  const handleOpenForm = () => {
    const street = addr.street || ""
    const parts = street
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    setFormData({
      addressLine1: parts[0] || "",
      addressLine2: parts.slice(1).join(", ") || "",
      city: addr.city || "",
      state: addr.state || "",
      pincode: addr.zipCode || "",
      country: addr.country || "",
      phone: profile?.phone || "",
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const street = [formData.addressLine1, formData.addressLine2].filter(Boolean).join(", ")
      await api.put("/users/profile", {
        name: profile?.name,
        phone: formData.phone?.trim() || null,
        address: {
          street: street || null,
          city: formData.city?.trim() || null,
          state: formData.state?.trim() || null,
          zipCode: formData.pincode?.trim() || null,
          country: formData.country?.trim() || null,
        },
      })
      onUpdate()
      setShowForm(false)
    } catch (error) {
      console.error("Error saving address:", error)
      alert("Failed to save address")
    } finally {
      setSaving(false)
    }
  }

  const hasAddress = !!(addr.street || addr.city || addr.state || addr.zipCode || addr.country)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Shipping & Billing Address</h3>
        <button onClick={handleOpenForm} className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors">
          {hasAddress ? "Edit Address" : "+ Add Address"}
        </button>
      </div>

      {showForm && (
        <div className="p-6 border-b border-gray-100 bg-gray-50">
          <h4 className="font-medium text-gray-900 mb-4">{hasAddress ? "Edit Address" : "Add default address"}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="tel" placeholder="Phone Number" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "").slice(0, 15) })} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            <div className="md:col-span-2" />
            <input type="text" placeholder="Address Line 1" value={formData.addressLine1} onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })} className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            <input type="text" placeholder="Address Line 2 (Optional)" value={formData.addressLine2} onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })} className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            <input type="text" placeholder="City" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            <input type="text" placeholder="State" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            <input type="text" placeholder="Pincode" value={formData.pincode} onChange={(e) => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, "").slice(0, 10) })} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            <input type="text" placeholder="Country" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div className="flex justify-end space-x-3 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? "Saving..." : "Save Address"}
            </button>
          </div>
        </div>
      )}

      <div className="p-6">
        {!hasAddress && !showForm ? (
          <p className="text-gray-500 text-center py-8">No saved address. Add your default shipping and billing address.</p>
        ) : !showForm ? (
          <div className="p-4 border border-gray-200 rounded-lg">
            <p className="font-medium text-gray-900">{profile?.name}</p>
            <p className="text-sm text-gray-600">{addr.street}</p>
            <p className="text-sm text-gray-600">
              {[addr.city, addr.state].filter(Boolean).join(", ")}
              {addr.zipCode ? ` - ${addr.zipCode}` : ""}
              {addr.country ? `, ${addr.country}` : ""}
            </p>
            <p className="text-sm text-gray-600">Phone: {profile?.phone || "-"}</p>
            <button onClick={handleOpenForm} className="text-sm text-blue-600 hover:text-blue-700 mt-2">
              Edit
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// Order status & payment status labels and badge styles (aligned with order API enums)
const ORDER_STATUS_MAP = {
  pending: { label: "Pending", class: "bg-amber-100 text-amber-800" },
  confirmed: { label: "Confirmed", class: "bg-blue-100 text-blue-800" },
  processing: { label: "Processing", class: "bg-indigo-100 text-indigo-800" },
  shipped: { label: "Shipped", class: "bg-purple-100 text-purple-800" },
  delivered: { label: "Delivered", class: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", class: "bg-red-100 text-red-800" },
  returned: { label: "Returned", class: "bg-gray-100 text-gray-800" },
}
const PAYMENT_STATUS_MAP = {
  pending: { label: "Pending", class: "bg-amber-100 text-amber-800" },
  processing: { label: "Processing", class: "bg-blue-100 text-blue-800" },
  paid: { label: "Paid", class: "bg-green-100 text-green-800" },
  failed: { label: "Failed", class: "bg-red-100 text-red-800" },
  refunded: { label: "Refunded", class: "bg-gray-100 text-gray-800" },
  cancelled: { label: "Cancelled", class: "bg-red-100 text-red-800" },
}

function OrdersTab({ isAuthenticated, token }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState(null)

  const fetchOrders = async () => {
    if (!isAuthenticated || !token) return
    try {
      const response = await api.get("/orders/my-orders")
      setOrders(response.data || [])
    } catch (error) {
      if (error?.response?.status === 401) {
        setOrders([])
      }
      console.error("Error fetching orders:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false)
      return
    }
    fetchOrders()
  }, [isAuthenticated, token])

  const handleCancelOrder = async (orderId) => {
    setCancellingId(orderId)
    try {
      await api.post(`/orders/${orderId}/cancel`)
      await fetchOrders()
    } catch (err) {
      const msg = err?.response?.data?.msg || err?.message || "Failed to cancel order"
      alert(msg)
    } finally {
      setCancellingId(null)
    }
  }

  const getBaseUrl = () => (typeof window !== "undefined" && process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, "") : "http://localhost:8080")

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Your Orders</h2>

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
          <p className="text-gray-500 mb-4">Start shopping to see your orders here!</p>
          <a href="/" className="inline-block px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
            Browse Products
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const orderStatusInfo = ORDER_STATUS_MAP[order.orderStatus] || { label: order.orderStatus, class: "bg-gray-100 text-gray-800" }
            const paymentStatusInfo = PAYMENT_STATUS_MAP[order.paymentStatus] || { label: order.paymentStatus, class: "bg-gray-100 text-gray-800" }
            const canCancel = ["pending", "confirmed"].includes(order.orderStatus)
            return (
              <div key={order._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Order #{order.orderNumber || order._id?.slice(-8).toUpperCase()}</p>
                    <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-gray-900">₹{Number(order.totalAmount ?? order.amount ?? 0).toFixed(0)}</p>
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${orderStatusInfo.class}`}>{orderStatusInfo.label}</span>
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${paymentStatusInfo.class}`}>{paymentStatusInfo.label}</span>
                    {canCancel && (
                      <button type="button" onClick={() => handleCancelOrder(order._id)} disabled={cancellingId === order._id} className="px-3 py-1 text-xs font-medium text-red-700 bg-red-50 rounded hover:bg-red-100 transition-colors disabled:opacity-50">
                        {cancellingId === order._id ? "Cancelling..." : "Cancel order"}
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  {order.products?.map((item, idx) => {
                    const img = item.productImage || item.product?.images?.[0] || item.product?.image
                    const src = img && (img.startsWith("http") ? img : `${getBaseUrl()}${img.startsWith("/") ? "" : "/"}${img}`)
                    return (
                      <div key={idx} className="flex items-center space-x-4 py-2">
                        {src && <Image src={getImageSrc(src) || src} alt={(item.productName || item.product?.name) ?? ""} width={64} height={64} className="w-16 h-16 object-cover rounded" />}
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{item.productName || item.product?.name || "Product"}</p>
                          <p className="text-sm text-gray-500">
                            Qty: {item.quantity} × ₹{Number(item.price || 0).toFixed(0)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function WishlistTab() {
  const [wishlist, setWishlist] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchWishlist = async () => {
    try {
      const response = await api.get("/wishlist")
      const items = response.data?.items ?? []
      setWishlist(items.map((i) => i.product).filter(Boolean))
    } catch (error) {
      if (error?.response?.status !== 401) console.error("Error fetching wishlist:", error)
      setWishlist([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWishlist()
  }, [])

  const removeFromWishlist = async (productId) => {
    try {
      await api.delete(`/wishlist/${productId}`)
      setWishlist(wishlist.filter((p) => (p._id || p.id) !== productId))
    } catch (error) {
      console.error("Error removing from wishlist:", error)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="h-48 bg-gray-200 rounded"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Your Wish List</h2>

      {wishlist.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Your wishlist is empty</h3>
          <p className="text-gray-500 mb-4">Save items you love by clicking the heart icon!</p>
          <a href="/" className="inline-block px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
            Browse Products
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {wishlist.map((product) => {
            const pid = product._id || product.id
            const imgSrc = product.mainImage?.startsWith("http") ? product.mainImage : product.mainImage ? `http://localhost:8080${product.mainImage}` : null
            const slug = getProductSlug(product)
            return (
              <div key={pid} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden group">
                <div className="relative">
                  <a href={slug ? `/products/${slug}` : "/products"}>
                    <Image src={imgSrc ? getImageSrc(imgSrc) || imgSrc : "/placeholder-product.png"} alt={product.name} width={400} height={160} className="w-full h-40 object-cover group-hover:scale-105 transition-transform" />
                  </a>
                  <button onClick={() => removeFromWishlist(pid)} className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-md text-red-500 hover:bg-red-50 transition-colors" title="Remove from wishlist">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                </div>
                <div className="p-4">
                  <a href={slug ? `/products/${slug}` : "/products"} className="font-medium text-gray-900 hover:text-blue-600 line-clamp-2">
                    {product.name}
                  </a>
                  <div className="mt-2 flex items-center space-x-2">
                    <span className="font-bold text-blue-600">₹{product.discountedPrice || product.price}</span>
                    {product.discountedPrice && <span className="text-sm text-gray-500 line-through">₹{product.price}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RecentlyViewedTab() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRecentlyViewed()
  }, [])

  const fetchRecentlyViewed = async () => {
    try {
      const response = await api.get("/recently-viewed-products")
      const raw = response.data?.items ?? response.data?.products ?? response.data ?? []
      const list = Array.isArray(raw) ? raw : []
      // Normalize: backend may return [{ product, viewedAt }] or [{ _id, name, ... }]
      const items = list.map((item) => (item.product != null ? item : { product: item, viewedAt: item.viewedAt ?? item.updatedAt ?? new Date().toISOString() }))
      setItems(items)
    } catch (error) {
      console.error("Error fetching recently viewed:", error)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="h-48 bg-gray-200 rounded"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Keep Shopping For</h2>
      <p className="text-gray-600">Products you recently viewed</p>

      {items.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No recently viewed items</h3>
          <p className="text-gray-500 mb-4">Start browsing to see your recently viewed products!</p>
          <a href="/" className="inline-block px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
            Browse Products
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((item) => {
            const slug = item.product ? getProductSlug(item.product) : ""
            return (
              <a key={item._id} href={slug ? `/products/${slug}` : "/products"} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden group hover:shadow-md transition-shadow">
                <Image src={getImageSrc(item.product?.mainImage) || item.product?.mainImage || ""} alt={item.product?.name ?? ""} width={400} height={128} className="w-full h-32 object-cover group-hover:scale-105 transition-transform" />
                <div className="p-3">
                  <p className="font-medium text-gray-900 text-sm line-clamp-2">{item.product?.name}</p>
                  <p className="text-blue-600 font-bold mt-1">₹{item.product?.discountedPrice || item.product?.price}</p>
                  <p className="text-xs text-gray-400 mt-1">Viewed {new Date(item.viewedAt).toLocaleDateString()}</p>
                </div>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RecommendationsTab() {
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRecommendations()
  }, [])

  const fetchRecommendations = async () => {
    try {
      const response = await api.get("/users/recommendations")
      setRecommendations(response.data || [])
    } catch (error) {
      console.error("Error fetching recommendations:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="h-48 bg-gray-200 rounded"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Your Recommendations</h2>
      <p className="text-gray-600">Products we think you&apos;ll love based on your activity</p>

      {recommendations.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No recommendations yet</h3>
          <p className="text-gray-500 mb-4">Browse more products to get personalized recommendations!</p>
          <a href="/" className="inline-block px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
            Browse Products
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {recommendations.map((product) => (
            <a key={product._id} href={getProductSlug(product) ? `/products/${getProductSlug(product)}` : "/products"} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden group hover:shadow-md transition-shadow">
              <Image src={getImageSrc(product.mainImage) || product.mainImage || ""} alt={product.name} width={400} height={128} className="w-full h-32 object-cover group-hover:scale-105 transition-transform" />
              <div className="p-3">
                <p className="font-medium text-gray-900 text-sm line-clamp-2">{product.name}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-blue-600 font-bold">₹{product.discountedPrice || product.price}</span>
                  {product.discountedPrice && <span className="text-xs text-gray-500 line-through">₹{product.price}</span>}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function ReturnsTab({ isAuthenticated, token }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchOrders = async () => {
    if (!isAuthenticated || !token) return
    try {
      const response = await api.get("/orders/my-orders")
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const eligibleOrders = (response.data || []).filter((order) => order.orderStatus === "delivered" && order.paymentStatus === "paid" && new Date(order.createdAt) > thirtyDaysAgo && order.orderStatus !== "returned")
      setOrders(eligibleOrders)
    } catch (error) {
      if (error?.response?.status === 401) setOrders([])
      console.error("Error fetching orders:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false)
      return
    }
    fetchOrders()
  }, [isAuthenticated, token])

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Returns</h2>
      <p className="text-gray-600">Orders eligible for return (within 30 days)</p>

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No return-eligible orders</h3>
          <p className="text-gray-500">Orders completed within the last 30 days will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-900">Order #{order.orderNumber || order._id?.slice(-8).toUpperCase()}</p>
                  <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900">₹{Number(order.totalAmount ?? 0).toFixed(0)}</p>
                  <button className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">Request Return</button>
                </div>
              </div>
              <div className="p-4">
                {order.products?.map((item, idx) => (
                  <div key={idx} className="flex items-center space-x-4 py-2">
                    {item.product?.mainImage && <Image src={getImageSrc(item.product.mainImage) || item.product.mainImage} alt={item.product.name ?? ""} width={48} height={48} className="w-12 h-12 object-cover rounded" />}
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{item.product?.name || "Product"}</p>
                      <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Main Account Page Content
function AccountPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, user, logout, openLoginModal } = useAuth()
  const [activeTab, setActiveTab] = useState("profile")
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const wasAuthenticated = useRef(false)

  const token = user?.token

  useEffect(() => {
    if (isAuthenticated) {
      wasAuthenticated.current = true
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      if (wasAuthenticated.current) {
        if (typeof window !== "undefined") window.location.replace("/")
        return
      }
      openLoginModal("/account")
      setLoading(false)
      return
    }
    if (token) {
      fetchProfile()
    } else {
      setLoading(false)
    }
  }, [isAuthenticated, token, openLoginModal])

  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab) {
      setActiveTab(tab)
    }
  }, [searchParams])

  const fetchProfile = async () => {
    try {
      let response = await api.get("/users/profile").catch((err) => {
        if (err.response?.status === 403) {
          return null
        }
        throw err
      })
      if (!response) {
        response = await api.get("/users/me")
      }
      setProfile(response?.data?.user ?? response?.data)
    } catch (error) {
      const status = error.response?.status
      if (status === 401 || status === 403) {
        logout()
        if (typeof window !== "undefined") window.location.replace("/")
        return
      }
      console.error("Error fetching profile:", error)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    router.push(`/account?tab=${tab}`, { scroll: false })
  }

  const tabs = [
    { id: "profile", label: "Your Account", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
    { id: "orders", label: "Your Orders", icon: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" },
    { id: "wishlist", label: "Wish List", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
    { id: "recently-viewed", label: "Keep Shopping For", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
    { id: "recommendations", label: "Recommendations", icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" },
    { id: "returns", label: "Returns", icon: "M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" },
  ]

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center px-4">
          <p className="text-gray-600 mb-4">Please log in to view your account.</p>
          <p className="text-sm text-gray-500">The login dialog should be open above. If not, use the LOGIN link in the menu.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="My Account" />

      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <aside className="lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden sticky top-24">
              {/* User Info */}
              <div className="p-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                <div className="flex items-center space-x-3">
                  {user?.user?.picture ? <Image src={user.user.picture} alt={user.user.name ?? ""} width={48} height={48} className="w-12 h-12 rounded-full border-2 border-white/30 object-cover" /> : <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-lg font-semibold">{user?.user?.name?.charAt(0).toUpperCase() || "U"}</div>}
                  <div>
                    <p className="font-semibold">{user?.user?.name}</p>
                    <p className="text-xs text-white/80">{user?.user?.email}</p>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <nav className="p-2">
                {tabs.map((tab) => (
                  <button key={tab.id} onClick={() => handleTabChange(tab.id)} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${activeTab === tab.id ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50"}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                    </svg>
                    <span className="text-sm font-medium">{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {activeTab === "profile" && <ProfileTab profile={profile} onUpdate={fetchProfile} loading={loading} />}
            {activeTab === "orders" && <OrdersTab isAuthenticated={isAuthenticated} token={token} />}
            {activeTab === "wishlist" && <WishlistTab />}
            {activeTab === "recently-viewed" && <RecentlyViewedTab />}
            {activeTab === "recommendations" && <RecommendationsTab />}
            {activeTab === "returns" && <ReturnsTab isAuthenticated={isAuthenticated} token={token} />}
          </main>
        </div>
      </div>
    </div>
  )
}

// Main Export with Suspense
export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <AccountPageContent />
    </Suspense>
  )
}
