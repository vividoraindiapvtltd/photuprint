import React, { useEffect, useMemo, useState } from "react"
import api from "../api/axios"

const DEFAULT_PATTERNS = ["Solid", "Striped", "Checked", "Printed"]
const DEFAULT_FIT_TYPES = ["Regular", "Slim", "Loose"]
const DEFAULT_SLEEVE_TYPES = ["Full Sleeve", "Half Sleeve", "Short Sleeve", "Sleeveless"]
const DEFAULT_COLLAR_STYLES = ["Mandarin", "Spread", "Button Down", "Band Collar"]

const ProductAttributeManager = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8080"

  const [attributes, setAttributes] = useState([])
  const [loading, setLoading] = useState(true)

  // Form states
  const [attributeId, setAttributeId] = useState(null)
  const [width, setWidth] = useState("")
  const [height, setHeight] = useState("")
  const [length, setLength] = useState("")
  const [pattern, setPattern] = useState("")
  const [fitType, setFitType] = useState("")
  const [sleeveType, setSleeveType] = useState("")
  const [collarStyle, setCollarStyle] = useState("")
  const [countryOfOrigin, setCountryOfOrigin] = useState("")
  const [pinCode, setPinCode] = useState("")
  const [category, setCategory] = useState("")
  const [subcategory, setSubcategory] = useState("")
  const [errors, setErrors] = useState({})

  // Dropdown data
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])

  // Search
  const [q, setQ] = useState("")

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return attributes
    return attributes.filter((a) => a.pattern?.toLowerCase().includes(query) || a.fitType?.toLowerCase().includes(query) || a.sleeveType?.toLowerCase().includes(query) || a.collarStyle?.toLowerCase().includes(query) || a.countryOfOrigin?.toLowerCase().includes(query) || a.pinCode?.toLowerCase().includes(query))
  }, [q, attributes])

  // Fetch data
  const fetchAttributes = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/product-attributes`)
      const data = await res.json()
      setAttributes(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error("Failed to load attributes", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAttributes()
  }, [API_BASE_URL])

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get("/categories?showInactive=false&includeDeleted=false")
        setCategories(response.data || [])
      } catch (err) {
        console.error("Error fetching categories:", err)
      }
    }
    fetchCategories()
  }, [])

  // Fetch subcategories when category changes
  useEffect(() => {
    const fetchSubcategories = async () => {
      if (!category) {
        setSubcategories([])
        setSubcategory("") // Clear subcategory when category is cleared
        return
      }
      try {
        const response = await api.get(`/subcategories?category=${category}&showInactive=false&includeDeleted=false`)
        setSubcategories(response.data || [])
        setSubcategory("") // Clear subcategory when category changes
      } catch (err) {
        console.error("Error fetching subcategories:", err)
        setSubcategories([])
        setSubcategory("")
      }
    }
    fetchSubcategories()
  }, [category])

  // Validation
  const validate = () => {
    const errs = {}
    if (!width) errs.width = "Width is required"
    if (!height) errs.height = "Height is required"
    if (!length) errs.length = "Length is required"
    if (!pattern) errs.pattern = "Pattern is required"
    if (!fitType) errs.fitType = "Fit type is required"
    if (!sleeveType) errs.sleeveType = "Sleeve type is required"
    if (!collarStyle) errs.collarStyle = "Collar style is required"
    if (!countryOfOrigin.trim()) errs.countryOfOrigin = "Country is required"
    if (!pinCode.trim()) errs.pinCode = "Pin code is required"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // Reset
  const resetForm = () => {
    setAttributeId(null)
    setWidth("")
    setHeight("")
    setLength("")
    setPattern("")
    setFitType("")
    setSleeveType("")
    setCollarStyle("")
    setCountryOfOrigin("")
    setPinCode("")
    setCategory("")
    setSubcategory("")
    setErrors({})
  }

  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    const payload = {
      width,
      height,
      length,
      pattern,
      fitType,
      sleeveType,
      collarStyle,
      countryOfOrigin,
      pinCode,
      category: category || null,
      subcategory: subcategory || null,
    }

    try {
      const endpoint = attributeId ? `${API_BASE_URL}/api/product-attributes/${attributeId}` : `${API_BASE_URL}/api/product-attributes`
      const method = attributeId ? "PUT" : "POST"
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || "Failed to save")
      }

      await fetchAttributes()
      resetForm()
    } catch (err) {
      console.error(err)
      alert(err.message || "Error saving")
    }
  }

  // Edit
  const handleEdit = (a) => {
    setAttributeId(a._id)
    setWidth(a.width || "")
    setHeight(a.height || "")
    setLength(a.length || "")
    setPattern(a.pattern || "")
    setFitType(a.fitType || "")
    setSleeveType(a.sleeveType || "")
    setCollarStyle(a.collarStyle || "")
    setCountryOfOrigin(a.countryOfOrigin || "")
    setPinCode(a.pinCode || "")
    const categoryId = a.category || ""
    setCategory(categoryId)
    setSubcategory(a.subcategory || "")
    setErrors({})
    
    // Fetch subcategories for the selected category if it exists
    if (categoryId) {
      api.get(`/subcategories?category=${categoryId}&showInactive=false&includeDeleted=false`)
        .then((response) => {
          setSubcategories(response.data || [])
        })
        .catch((err) => {
          console.error("Error fetching subcategories:", err)
          setSubcategories([])
        })
    } else {
      setSubcategories([])
    }
    
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Delete
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this attribute?")) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/product-attributes/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete")
      setAttributes((prev) => prev.filter((a) => a._id !== id))
    } catch (e) {
      console.error(e)
      alert("Error deleting")
    }
  }

  return (
    <div className="p-4 bg-white rounded-xl shadow max-w-6xl mx-auto">
      <h2 className="text-xl font-bold mb-4">{attributeId ? "Edit Product Attribute" : "Product Attribute Manager"}</h2>

      {/* Form */}
      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-3">
        {/* Category */}
        <div>
          <label className="font-medium">Category</label>
          <select className="border rounded px-3 py-2 w-full" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Select category (optional)</option>
            {categories.map((cat) => (
              <option key={cat._id} value={cat._id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Subcategory */}
        <div>
          <label className="font-medium">Subcategory</label>
          <select 
            className="border rounded px-3 py-2 w-full" 
            value={subcategory} 
            onChange={(e) => setSubcategory(e.target.value)}
            disabled={!category}
          >
            <option value="">{category ? "Select subcategory (optional)" : "Select category first"}</option>
            {subcategories.map((subcat) => (
              <option key={subcat._id} value={subcat._id}>
                {subcat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Width */}
        <div>
          <label className="font-medium">Width (cm)</label>
          <input type="number" className="border rounded px-3 py-2 w-full" value={width} onChange={(e) => setWidth(e.target.value)} />
          {errors.width && <p className="text-sm text-red-600">{errors.width}</p>}
        </div>

        {/* Height */}
        <div>
          <label className="font-medium">Height (cm)</label>
          <input type="number" className="border rounded px-3 py-2 w-full" value={height} onChange={(e) => setHeight(e.target.value)} />
          {errors.height && <p className="text-sm text-red-600">{errors.height}</p>}
        </div>

        {/* Length */}
        <div>
          <label className="font-medium">Length (cm)</label>
          <input type="number" className="border rounded px-3 py-2 w-full" value={length} onChange={(e) => setLength(e.target.value)} />
          {errors.length && <p className="text-sm text-red-600">{errors.length}</p>}
        </div>

        {/* Pattern */}
        <div>
          <label className="font-medium">Pattern</label>
          <select className="border rounded px-3 py-2 w-full" value={pattern} onChange={(e) => setPattern(e.target.value)}>
            <option value="">Select pattern</option>
            {DEFAULT_PATTERNS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {errors.pattern && <p className="text-sm text-red-600">{errors.pattern}</p>}
        </div>

        {/* Fit Type */}
        <div>
          <label className="font-medium">Fit Type</label>
          <select className="border rounded px-3 py-2 w-full" value={fitType} onChange={(e) => setFitType(e.target.value)}>
            <option value="">Select fit type</option>
            {DEFAULT_FIT_TYPES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          {errors.fitType && <p className="text-sm text-red-600">{errors.fitType}</p>}
        </div>

        {/* Sleeve Type */}
        <div>
          <label className="font-medium">Sleeve Type</label>
          <select className="border rounded px-3 py-2 w-full" value={sleeveType} onChange={(e) => setSleeveType(e.target.value)}>
            <option value="">Select sleeve type</option>
            {DEFAULT_SLEEVE_TYPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {errors.sleeveType && <p className="text-sm text-red-600">{errors.sleeveType}</p>}
        </div>

        {/* Collar Style */}
        <div>
          <label className="font-medium">Collar Style</label>
          <select className="border rounded px-3 py-2 w-full" value={collarStyle} onChange={(e) => setCollarStyle(e.target.value)}>
            <option value="">Select collar style</option>
            {DEFAULT_COLLAR_STYLES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {errors.collarStyle && <p className="text-sm text-red-600">{errors.collarStyle}</p>}
        </div>

        {/* Country of Origin */}
        <div>
          <label className="font-medium">Country of Origin</label>
          <input type="text" className="border rounded px-3 py-2 w-full" value={countryOfOrigin} onChange={(e) => setCountryOfOrigin(e.target.value)} />
          {errors.countryOfOrigin && <p className="text-sm text-red-600">{errors.countryOfOrigin}</p>}
        </div>

        {/* Pin Code */}
        <div>
          <label className="font-medium">Pin Code</label>
          <input type="text" className="border rounded px-3 py-2 w-full" value={pinCode} onChange={(e) => setPinCode(e.target.value)} />
          {errors.pinCode && <p className="text-sm text-red-600">{errors.pinCode}</p>}
        </div>

        {/* Actions */}
        <div className="md:col-span-3 flex gap-2 mt-2">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
            {attributeId ? "Update Attribute" : "Add Attribute"}
          </button>
          {attributeId && (
            <button type="button" onClick={resetForm} className="border px-4 py-2 rounded">
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Divider */}
      <hr className="my-6" />

      {/* Search */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">{loading ? "Loading..." : `Attributes (${attributes.length})`}</h3>
        <input className="border rounded px-3 py-2" placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {/* Table */}
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 border">Category</th>
              <th className="p-2 border">Subcategory</th>
              <th className="p-2 border">Width</th>
              <th className="p-2 border">Height</th>
              <th className="p-2 border">Length</th>
              <th className="p-2 border">Pattern</th>
              <th className="p-2 border">Fit Type</th>
              <th className="p-2 border">Sleeve Type</th>
              <th className="p-2 border">Collar Style</th>
              <th className="p-2 border">Country</th>
              <th className="p-2 border">Pin Code</th>
              <th className="p-2 border w-40">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan="12" className="p-4 text-center text-gray-500">
                  No attributes found
                </td>
              </tr>
            )}
            {filtered.map((a) => {
              const categoryName = categories.find(c => c._id === a.category)?.name || a.category || "-"
              const subcategoryName = subcategories.find(s => s._id === a.subcategory)?.name || 
                                     (a.subcategory && !subcategories.find(s => s._id === a.subcategory) ? a.subcategory : "-")
              return (
                <tr key={a._id}>
                  <td className="p-2 border">{categoryName}</td>
                  <td className="p-2 border">{subcategoryName}</td>
                  <td className="p-2 border">{a.width}</td>
                  <td className="p-2 border">{a.height}</td>
                  <td className="p-2 border">{a.length}</td>
                  <td className="p-2 border">{a.pattern}</td>
                  <td className="p-2 border">{a.fitType}</td>
                  <td className="p-2 border">{a.sleeveType}</td>
                  <td className="p-2 border">{a.collarStyle}</td>
                  <td className="p-2 border">{a.countryOfOrigin}</td>
                  <td className="p-2 border">{a.pinCode}</td>
                <td className="p-2 border">
                  <div className="flex gap-2">
                    <button className="px-2 py-1 rounded text-white bg-emerald-600" onClick={() => handleEdit(a)}>
                      Edit
                    </button>
                    <button className="px-2 py-1 rounded text-white bg-red-600" onClick={() => handleDelete(a._id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
              )
            })}
            {loading && (
              <tr>
                <td colSpan="12" className="p-4 text-center">
                  Loading...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ProductAttributeManager
