import React, { useCallback, useEffect, useState } from "react"
import api from "../api/axios"
import { PageHeader, AlertMessage } from "../common"

const emptyForm = {
  scope: "default",
  category: "",
  product: "",
  percent: "",
  expiryDays: 90,
  priority: 0,
  isActive: true,
  notes: "",
}

export default function CashbackRulesManager() {
  const [rules, setRules] = useState([])
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const loadRules = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await api.get("/cashback-rules")
      setRules(Array.isArray(res.data) ? res.data : [])
    } catch (e) {
      setError(e.response?.data?.msg || e.message || "Failed to load rules")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCategories = useCallback(async () => {
    try {
      const res = await api.get("/categories?showInactive=true&includeDeleted=false")
      setCategories(Array.isArray(res.data) ? res.data : [])
    } catch {
      setCategories([])
    }
  }, [])

  const loadProducts = useCallback(async () => {
    try {
      const res = await api.get("/products?showInactive=true&includeDeleted=false&limit=500")
      const list = res.data?.products ?? (Array.isArray(res.data) ? res.data : [])
      setProducts(Array.isArray(list) ? list : [])
    } catch {
      setProducts([])
    }
  }, [])

  useEffect(() => {
    loadRules()
    loadCategories()
    loadProducts()
  }, [loadRules, loadCategories, loadProducts])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((f) => ({
      ...f,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  const handleEdit = (r) => {
    setEditingId(r._id)
    setForm({
      scope: r.scope || "default",
      category: r.category ? String(r.category) : "",
      product: r.product ? String(r.product) : "",
      percent: r.percent != null ? String(r.percent) : "",
      expiryDays: r.expiryDays ?? 90,
      priority: r.priority ?? 0,
      isActive: r.isActive !== false,
      notes: r.notes || "",
    })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    setSuccess("")
    const percent = Number(form.percent)
    if (Number.isNaN(percent) || percent < 0 || percent > 100) {
      setError("Percent must be between 0 and 100")
      setSaving(false)
      return
    }
    const body = {
      scope: form.scope,
      percent,
      expiryDays: Number(form.expiryDays) || 90,
      priority: Number(form.priority) || 0,
      isActive: form.isActive,
      notes: form.notes?.trim() || null,
      category: form.scope === "category" ? form.category || null : null,
      product: form.scope === "product" ? form.product || null : null,
    }
    if (body.scope === "category" && !body.category) {
      setError("Select a category for category scope")
      setSaving(false)
      return
    }
    if (body.scope === "product" && !body.product) {
      setError("Select a product for product scope")
      setSaving(false)
      return
    }
    try {
      if (editingId) {
        await api.put(`/cashback-rules/${editingId}`, body)
        setSuccess("Rule updated")
      } else {
        await api.post("/cashback-rules", body)
        setSuccess("Rule created")
      }
      resetForm()
      await loadRules()
    } catch (err) {
      setError(err.response?.data?.msg || err.message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this cashback rule?")) return
    setError("")
    try {
      await api.delete(`/cashback-rules/${id}`)
      setSuccess("Rule deleted")
      if (editingId === id) resetForm()
      await loadRules()
    } catch (err) {
      setError(err.response?.data?.msg || err.message || "Delete failed")
    }
  }

  const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }
  const thtd = { border: "1px solid #e5e7eb", padding: "0.5rem 0.6rem", textAlign: "left" }

  return (
    <div className="rightContainer" style={{ padding: "1.5rem" }}>
      <PageHeader
        title="Cashback rules"
        subtitle="Default, category, or product-level cashback. Higher priority wins within the same scope tier."
      />

      {error ? <AlertMessage type="error" message={error} onClose={() => setError("")} /> : null}
      {success ? <AlertMessage type="success" message={success} onClose={() => setSuccess("")} /> : null}

      <form
        onSubmit={handleSubmit}
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: "1.25rem",
          marginBottom: "1.5rem",
          maxWidth: 560,
          background: "#fafafa",
        }}
      >
        <h3 style={{ marginTop: 0 }}>{editingId ? "Edit rule" : "New rule"}</h3>

        <div style={{ marginBottom: "0.75rem" }}>
          <label className="formLabel">Scope</label>
          <select name="scope" className="formInput formSelect" value={form.scope} onChange={handleChange}>
            <option value="default">Default (site-wide fallback)</option>
            <option value="category">Category</option>
            <option value="product">Product</option>
          </select>
        </div>

        {form.scope === "category" && (
          <div style={{ marginBottom: "0.75rem" }}>
            <label className="formLabel">Category</label>
            <select name="category" className="formInput formSelect" value={form.category} onChange={handleChange}>
              <option value="">— Select —</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {form.scope === "product" && (
          <div style={{ marginBottom: "0.75rem" }}>
            <label className="formLabel">Product</label>
            <select name="product" className="formInput formSelect" value={form.product} onChange={handleChange}>
              <option value="">— Select —</option>
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name || p.slug || p._id}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ marginBottom: "0.75rem" }}>
          <label className="formLabel">Cashback %</label>
          <input
            name="percent"
            type="number"
            min={0}
            max={100}
            step={0.01}
            className="formInput"
            value={form.percent}
            onChange={handleChange}
            required
          />
        </div>

        <div style={{ marginBottom: "0.75rem" }}>
          <label className="formLabel">Expiry (days after credit)</label>
          <input
            name="expiryDays"
            type="number"
            min={1}
            max={3650}
            className="formInput"
            value={form.expiryDays}
            onChange={handleChange}
          />
        </div>

        <div style={{ marginBottom: "0.75rem" }}>
          <label className="formLabel">Priority (higher first)</label>
          <input name="priority" type="number" className="formInput" value={form.priority} onChange={handleChange} />
        </div>

        <div style={{ marginBottom: "0.75rem" }}>
          <label className="formLabel">Notes (optional)</label>
          <input name="notes" className="formInput" value={form.notes} onChange={handleChange} />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem" }}>
          <input name="isActive" type="checkbox" checked={form.isActive} onChange={handleChange} />
          Active
        </label>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button type="submit" className="btnPrimary" disabled={saving}>
            {saving ? "Saving…" : editingId ? "Update" : "Create"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              style={{
                padding: "0.55rem 1rem",
                background: "#fff",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>

      <h3 style={{ marginBottom: "0.75rem" }}>Existing rules</h3>
      {loading ? (
        <p>Loading…</p>
      ) : rules.length === 0 ? (
        <p style={{ color: "#6b7280" }}>No rules yet. Add a default rule to enable cashback.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                <th style={thtd}>Scope</th>
                <th style={thtd}>%</th>
                <th style={thtd}>Expiry days</th>
                <th style={thtd}>Priority</th>
                <th style={thtd}>Active</th>
                <th style={thtd} />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r._id}>
                  <td style={thtd}>
                    {r.scope}
                    {r.scope === "category" && r.category ? ` (${String(r.category).slice(-6)})` : ""}
                    {r.scope === "product" && r.product ? ` (${String(r.product).slice(-6)})` : ""}
                  </td>
                  <td style={thtd}>{r.percent}</td>
                  <td style={thtd}>{r.expiryDays}</td>
                  <td style={thtd}>{r.priority}</td>
                  <td style={thtd}>{r.isActive ? "Yes" : "No"}</td>
                  <td style={thtd}>
                    <button
                      type="button"
                      onClick={() => handleEdit(r)}
                      style={{ background: "none", border: "none", color: "#007bff", cursor: "pointer", padding: 0 }}
                    >
                      Edit
                    </button>{" "}
                    <button
                      type="button"
                      onClick={() => handleDelete(r._id)}
                      style={{ background: "none", border: "none", color: "#dc3545", cursor: "pointer", padding: 0 }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
