import React, { useEffect, useState } from "react"
import api from "../api/axios"
import { PageHeader, AlertMessage, FormField, ActionButtons, SearchField, Pagination } from "../common"
import { usePermissions } from "../context/PermissionContext"

const PERIOD_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "one_time", label: "One time" },
]

const TYPE_OPTIONS = [
  { value: "fixed", label: "Fixed amount" },
  { value: "percentage", label: "Percentage of revenue" },
]

const IncentiveManager = () => {
  const { isSuperAdmin } = usePermissions()

  const [incentives, setIncentives] = useState([])
  const [salesAgents, setSalesAgents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const [formData, setFormData] = useState({
    agent: "",
    name: "",
    description: "",
    type: "fixed",
    amount: "",
    period: "monthly",
    month: "",
    year: new Date().getFullYear(),
    targetLeads: "",
    targetRevenue: "",
    isActive: true,
  })

  useEffect(() => {
    fetchSalesAgents()
    fetchIncentives()
  }, [])

  const fetchSalesAgents = async () => {
    try {
      const config = isSuperAdmin
        ? { params: { role: "editor" }, skipWebsiteId: true }
        : { params: { role: "editor" } }
      const res = await api.get("/users", config)
      setSalesAgents(res.data || [])
    } catch (err) {
      console.error("Error fetching sales agents:", err)
    }
  }

  const fetchIncentives = async () => {
    try {
      setLoading(true)
      setError("")
      const res = await api.get("/incentives")
      setIncentives(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error("Error fetching incentives:", err)
      setError("Failed to load incentives.")
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setFormData((prev) => ({
      agent: "",
      name: "",
      description: "",
      type: "fixed",
      amount: "",
      period: "monthly",
      month: "",
      year: new Date().getFullYear(),
      targetLeads: "",
      targetRevenue: "",
      isActive: true,
    }))
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  const handleEdit = (incentive) => {
    setEditingId(incentive._id)
    setFormData({
      agent: incentive.agent?._id || "",
      name: incentive.name || "",
      description: incentive.description || "",
      type: incentive.type || "fixed",
      amount: incentive.amount ?? "",
      period: incentive.period || "monthly",
      month: incentive.month ?? "",
      year: incentive.year ?? new Date().getFullYear(),
      targetLeads: incentive.targetLeads ?? "",
      targetRevenue: incentive.targetRevenue ?? "",
      isActive: incentive.isActive ?? true,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.agent) {
      setError("Please select a sales agent.")
      return
    }
    if (!formData.name) {
      setError("Please enter an incentive name.")
      return
    }
    if (!formData.amount) {
      setError("Please enter an incentive amount.")
      return
    }
    try {
      setLoading(true)
      setError("")
      const payload = {
        ...formData,
        amount: Number(formData.amount),
        month: formData.month ? Number(formData.month) : undefined,
        year: formData.year ? Number(formData.year) : undefined,
        targetLeads: formData.targetLeads ? Number(formData.targetLeads) : 0,
        targetRevenue: formData.targetRevenue ? Number(formData.targetRevenue) : 0,
      }
      if (editingId) {
        await api.put(`/incentives/${editingId}`, payload)
        setSuccess("Incentive updated successfully.")
      } else {
        await api.post("/incentives", payload)
        setSuccess("Incentive created successfully.")
      }
      resetForm()
      await fetchIncentives()
    } catch (err) {
      console.error("Error saving incentive:", err)
      setError(err.response?.data?.msg || "Failed to save incentive.")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this incentive?")) return
    try {
      setLoading(true)
      setError("")
      await api.delete(`/incentives/${id}`)
      setSuccess("Incentive deleted successfully.")
      await fetchIncentives()
    } catch (err) {
      console.error("Error deleting incentive:", err)
      setError("Failed to delete incentive.")
    } finally {
      setLoading(false)
    }
  }

  const filteredIncentives = incentives.filter((inc) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    const agentName = inc.agent?.name?.toLowerCase() || ""
    const agentEmail = inc.agent?.email?.toLowerCase() || ""
    return (
      inc.name?.toLowerCase().includes(q) ||
      agentName.includes(q) ||
      agentEmail.includes(q)
    )
  })

  const totalPages = Math.max(1, Math.ceil(filteredIncentives.length / pageSize))
  const currentItems = filteredIncentives.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handlePageChange = (page) => {
    setCurrentPage(page)
  }

  return (
    <div className="paddingAll20">
      <PageHeader
        title="Incentive Manager"
        subtitle="Assign incentives to sales agents"
        customTitle={
          <span className="makeFlex alignCenter gap8">
            <span role="img" aria-label="Incentive">💰</span>
            <span>Incentive Manager</span>
          </span>
        }
      />

      {error && (
        <AlertMessage type="error" message={error} onClose={() => setError("")} />
      )}
      {success && (
        <AlertMessage type="success" message={success} onClose={() => setSuccess("")} />
      )}

      <div className="brandFormContainer paddingAll32 appendBottom30">
        <form onSubmit={handleSubmit}>
          <div className="makeFlex row gap16 appendBottom16">
            <div className="flexOne">
              <FormField
                type="select"
                name="agent"
                label="Sales agent"
                value={formData.agent}
                onChange={handleChange}
                options={[
                  { value: "", label: "Select agent" },
                  ...salesAgents.map((u) => ({
                    value: u._id,
                    label: u.name || u.email,
                  })),
                ]}
              />
            </div>
            <div className="flexOne">
              <FormField
                type="text"
                name="name"
                label="Incentive name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Monthly lead bonus"
              />
            </div>
          </div>

          <div className="makeFlex row gap16 appendBottom16">
            <div className="flexOne">
              <FormField
                type="select"
                name="type"
                label="Incentive type"
                value={formData.type}
                onChange={handleChange}
                options={TYPE_OPTIONS}
              />
            </div>
            <div className="flexOne">
              <FormField
                type="number"
                name="amount"
                label={formData.type === "percentage" ? "Percentage (%)" : "Amount (₹)"}
                value={formData.amount}
                onChange={handleChange}
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <p className="font12 grayText appendBottom16">
            Percentage / amount is calculated only on product value (order subtotal), excluding GST, shipping and other charges.
          </p>

          <div className="makeFlex row gap16 appendBottom16">
            <div className="flexOne">
              <FormField
                type="select"
                name="period"
                label="Period"
                value={formData.period}
                onChange={handleChange}
                options={PERIOD_OPTIONS}
              />
            </div>
            <div className="flexOne">
              <FormField
                type="number"
                name="month"
                label="Month (1-12, optional)"
                value={formData.month}
                onChange={handleChange}
                min="1"
                max="12"
              />
            </div>
            <div className="flexOne">
              <FormField
                type="number"
                name="year"
                label="Year"
                value={formData.year}
                onChange={handleChange}
                min="2020"
                max="2100"
              />
            </div>
          </div>
          <p className="font12 grayText appendBottom16">
            Use period, month and year to define which month or cycle this incentive applies to. Leave month empty to apply for the full period in that year.
          </p>

          <div className="makeFlex row gap16 appendBottom16">
            <div className="flexOne">
              <FormField
                type="number"
                name="targetLeads"
                label="Target leads (optional)"
                value={formData.targetLeads}
                onChange={handleChange}
                min="0"
              />
            </div>
            <div className="flexOne">
              <FormField
                type="number"
                name="targetRevenue"
                label="Target revenue (optional)"
                value={formData.targetRevenue}
                onChange={handleChange}
                min="0"
              />
            </div>
          </div>
          <p className="font12 grayText appendBottom16">
            Targets are optional and used only for tracking; incentives are still based on subtotal, not on GST, shipping or extra charges.
          </p>

          <div className="appendBottom16">
            <FormField
              type="textarea"
              name="description"
              label="Description (optional)"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Describe the incentive criteria, payout rules, etc."
            />
          </div>

          <div className="makeFlex row gap10">
            <div className="makeFlex column flexOne appendBottom16">
              <label className="formLabel appendBottom10">Status:</label>
              <label className="formLabel appendBottom8 makeFlex gap10">
                <FormField
                  type="checkbox"
                  name="isActive"
                  value={formData.isActive}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, isActive: e.target.checked }))
                  }
                />
                Active
              </label>
              <p className="negativeMarginTop10">
                Check this box to keep the incentive active, uncheck to pause it
              </p>
            </div>
          </div>

          <div className="formActions paddingTop16">
            <button type="submit" disabled={loading} className="btnPrimary">
              {loading ? "Saving..." : editingId ? "Update incentive" : "Create incentive"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="btnSecondary"
                disabled={loading}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">
              Incentives ({filteredIncentives.length})
            </h2>
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search incentives or agents..."
              disabled={loading}
              minWidth="250px"
            />
          </div>
        </div>

        {filteredIncentives.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">💰</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No incentives found</h3>
            <p className="font16 grayText">Create an incentive above to get started.</p>
          </div>
        ) : (
          <div className="brandsListTable">
            <div className="tableContainer" style={{ overflowX: "auto" }}>
              <table className="brandsTable" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f5f5f5" }}>
                    <th style={{ padding: "12px", textAlign: "left" }}>Agent</th>
                    <th style={{ padding: "12px", textAlign: "left" }}>Incentive</th>
                    <th style={{ padding: "12px", textAlign: "left" }}>Type</th>
                    <th style={{ padding: "12px", textAlign: "left" }}>Amount</th>
                    <th style={{ padding: "12px", textAlign: "left" }}>Period</th>
                    <th style={{ padding: "12px", textAlign: "left" }}>Targets</th>
                    <th style={{ padding: "12px", textAlign: "left" }}>Status</th>
                    <th style={{ padding: "12px", textAlign: "left" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.map((inc) => (
                    <tr key={inc._id} style={{ borderBottom: "1px solid #e0e0e0" }}>
                      <td style={{ padding: "12px" }}>
                        <div className="font14 fontSemiBold">
                          {inc.agent?.name || inc.agent?.email || "Unknown"}
                        </div>
                        <div className="font12 grayText">{inc.agent?.email}</div>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <div className="font14 fontSemiBold">{inc.name}</div>
                        {inc.description && (
                          <div className="font12 grayText">
                            {inc.description.length > 80
                              ? `${inc.description.slice(0, 80)}...`
                              : inc.description}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px" }}>
                        {inc.type === "percentage" ? "Percentage" : "Fixed amount"}
                      </td>
                      <td style={{ padding: "12px" }}>
                        {inc.type === "percentage"
                          ? `${inc.amount}%`
                          : `₹ ${inc.amount}`}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <div className="font14">
                          {PERIOD_OPTIONS.find((p) => p.value === inc.period)?.label ||
                            inc.period}
                        </div>
                        {(inc.month || inc.year) && (
                          <div className="font12 grayText">
                            {inc.month ? `Month ${inc.month}, ` : ""}Year {inc.year}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <div className="font12">
                          Leads:{" "}
                          <span className="fontSemiBold">
                            {inc.targetLeads || 0}
                          </span>
                        </div>
                        <div className="font12">
                          Revenue:{" "}
                          <span className="fontSemiBold">
                            {inc.targetRevenue || 0}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: "12px",
                            backgroundColor: inc.isActive ? "#28a745" : "#6c757d",
                            color: "#fff",
                            fontSize: "12px",
                          }}
                        >
                          {inc.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <ActionButtons
                          onEdit={() => handleEdit(inc)}
                          onDelete={isSuperAdmin ? () => handleDelete(inc._id) : undefined}
                          loading={loading}
                          size="small"
                          editText="✏️"
                          deleteText="🗑️"
                          editTitle="Edit incentive"
                          deleteTitle={
                            isSuperAdmin
                              ? "Delete incentive"
                              : "Only super admin can delete incentives"
                          }
                          deleteDisabled={!isSuperAdmin || loading}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                disabled={loading}
                showGoToPage={true}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default IncentiveManager

