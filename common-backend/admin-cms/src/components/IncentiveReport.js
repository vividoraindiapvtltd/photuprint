import React, { useEffect, useState, useCallback } from "react"
import api from "../api/axios"
import { usePermissions } from "../context/PermissionContext"
import { PageHeader, AlertMessage, FormField } from "../common"

const PERIOD_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
]

const getLoggedInUser = () => {
  try {
    const userStr = localStorage.getItem("user")
    if (userStr) return JSON.parse(userStr)
    const adminStr = localStorage.getItem("adminUser")
    if (adminStr) {
      const data = JSON.parse(adminStr)
      return data?.user || data
    }
  } catch (_) {}
  return null
}

const IncentiveReport = () => {
  const { isSuperAdmin, role, loading: permLoading } = usePermissions()
  const [loggedInUser] = useState(() => getLoggedInUser())

  // Determine agent status from both context and localStorage (sync fallback)
  const contextIsAgent = role === "editor" && !isSuperAdmin
  const localRole = loggedInUser?.role
  const isAgent = contextIsAgent || (localRole === "editor" && !isSuperAdmin)

  const [salesAgents, setSalesAgents] = useState([])
  const [agentId, setAgentId] = useState(() => {
    if (localRole === "editor") return loggedInUser?._id || ""
    return ""
  })
  const [period, setPeriod] = useState("monthly")
  const [month, setMonth] = useState("")
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [report, setReport] = useState(null)

  // When permission context finishes loading and user is an agent, ensure agentId is set
  useEffect(() => {
    if (!permLoading && isAgent && loggedInUser?._id && !agentId) {
      setAgentId(loggedInUser._id)
    }
  }, [permLoading, isAgent, loggedInUser, agentId])

  useEffect(() => {
    // Agents only see their own report — no need to fetch the agents list
    if (isAgent) return
    // Wait until permission context has loaded so isSuperAdmin is accurate
    if (permLoading) return

    const fetchSalesAgents = async () => {
      try {
        const config = isSuperAdmin
          ? { params: { role: "editor" }, skipWebsiteId: true }
          : { params: { role: "editor" } }
        const res = await api.get("/users", config)
        const agents = Array.isArray(res.data) ? res.data : []
        setSalesAgents(agents)
        if (agents.length > 0) {
          setAgentId((prev) => prev || agents[0]._id)
        }
      } catch (err) {
        console.error("Error fetching sales agents:", err)
        setSalesAgents([])
      }
    }
    fetchSalesAgents()
  }, [isSuperAdmin, isAgent, permLoading])

  const fetchReport = useCallback(async () => {
    if (!agentId) {
      setError("Please select a sales agent.")
      return
    }
    try {
      setLoading(true)
      setError("")
      setSuccess("")
      setReport(null)

      const params = {
        agentId,
        period,
        year,
        _t: Date.now(),
      }
      if (month) params.month = month

      const res = await api.get("/incentives/payout", { params })
      setReport(res.data)
      setSuccess("Incentive report generated successfully.")
    } catch (err) {
      console.error("Error fetching incentive report:", err)
      setError(err.response?.data?.msg || "Failed to load incentive report.")
    } finally {
      setLoading(false)
    }
  }, [agentId, period, month, year])

  useEffect(() => {
    if (agentId) {
      fetchReport()
    }
  }, [agentId, period, month, year, fetchReport])

  const agentOptions = [
    { value: "", label: "Select sales agent" },
    ...salesAgents.map((a) => ({
      value: a._id,
      label: a.name || a.email || a._id,
    })),
  ]

  return (
    <div className="paddingAll20">
      <PageHeader
        title="Incentive Report"
        subtitle="View incentive payout based on sales (product value only)"
        customTitle={
          <span className="makeFlex alignCenter gap8">
            <span role="img" aria-label="Report">📊</span>
            <span>Incentive Report</span>
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
        <div className="brandForm">
          <div className="makeFlex row gap16 appendBottom16">
            {isAgent ? (
              <div className="flexOne">
                <div className="font14 grayText appendBottom4">Sales agent</div>
                <div className="font16 fontBold blackText">
                  {loggedInUser?.name || loggedInUser?.email || "You"}
                </div>
              </div>
            ) : (
              <div className="flexOne">
                <FormField
                  type="select"
                  name="agentId"
                  label="Sales agent"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  options={agentOptions}
                  info="Select the agent to see their incentive payout."
                />
              </div>
            )}
            <div className="flexOne">
              <FormField
                type="select"
                name="period"
                label="Period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                options={PERIOD_OPTIONS}
                info="Choose whether to calculate incentives monthly, quarterly, or yearly."
              />
            </div>
          </div>

          <div className="makeFlex row gap16 appendBottom16">
            <div className="flexOne">
              <FormField
                type="number"
                name="month"
                label="Month (1-12, optional)"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                min="1"
                max="12"
                info="For monthly/one-time, set a specific month. Leave empty for full period."
              />
            </div>
            <div className="flexOne">
              <FormField
                type="number"
                name="year"
                label="Year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                min="2020"
                max="2100"
                info="Year for which to calculate the incentive payout."
              />
            </div>
          </div>

          <div className="formActions paddingTop16">
            <button
              type="button"
              onClick={fetchReport}
              disabled={loading || !agentId}
              className="btnPrimary"
            >
              {loading ? "Calculating..." : "Refresh report"}
            </button>
          </div>
        </div>
      </div>

      {report && (
        <div className="brandsListContainer paddingAll32">
          <div className="appendBottom24">
            <h2 className="listTitle font24 fontBold blackText appendBottom8">
              Summary
            </h2>
            <p className="font14 grayText">
              Incentive is calculated on product value (order subtotal minus discount) plus
              closed lead values, excluding GST, shipping and other charges.
            </p>
            {report.startDate && report.endDate && (
              <p className="font12 grayText appendTop4">
                Period: {new Date(report.startDate).toLocaleDateString("en-IN")} – {new Date(report.endDate).toLocaleDateString("en-IN")}
              </p>
            )}
          </div>

          <div className="makeFlex row gap16 appendBottom24" style={{ flexWrap: "wrap" }}>
            <div className="flexOne" style={{ minWidth: "180px" }}>
              <div className="brandCard paddingAll24">
                <div className="font14 grayText appendBottom4">Base revenue</div>
                <div className="font24 fontBold">
                  ₹ {Math.round(report.baseRevenue || 0).toLocaleString("en-IN")}
                </div>
              </div>
            </div>
            <div className="flexOne" style={{ minWidth: "180px" }}>
              <div className="brandCard paddingAll24">
                <div className="font14 grayText appendBottom4">Orders</div>
                <div className="font24 fontBold">
                  {report.orderCount || 0}
                </div>
              </div>
            </div>
            <div className="flexOne" style={{ minWidth: "180px" }}>
              <div className="brandCard paddingAll24">
                <div className="font14 grayText appendBottom4">Closed leads</div>
                <div className="font24 fontBold">
                  {report.leadCount || 0}
                </div>
              </div>
            </div>
            <div className="flexOne" style={{ minWidth: "180px" }}>
              <div className="brandCard paddingAll24">
                <div className="font14 grayText appendBottom4">Total payout</div>
                <div className="font24 fontBold greenText">
                  ₹ {Math.round(report.totalPayout || 0).toLocaleString("en-IN")}
                </div>
              </div>
            </div>
          </div>

          <div className="brandsListTable appendBottom30">
            <div className="tableContainer" style={{ overflowX: "auto" }}>
              <table className="brandsTable" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f5f5f5" }}>
                    <th style={{ padding: "12px", textAlign: "left" }}>Incentive</th>
                    <th style={{ padding: "12px", textAlign: "left" }}>Type</th>
                    <th style={{ padding: "12px", textAlign: "left" }}>Amount</th>
                    <th style={{ padding: "12px", textAlign: "left" }}>Targets</th>
                    <th style={{ padding: "12px", textAlign: "left" }}>Met?</th>
                    <th style={{ padding: "12px", textAlign: "left" }}>Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.incentives || []).map((inc) => (
                    <tr key={inc.incentiveId} style={{ borderBottom: "1px solid #e0e0e0" }}>
                      <td style={{ padding: "12px" }}>
                        <div className="font14 fontSemiBold">{inc.name}</div>
                      </td>
                      <td style={{ padding: "12px" }}>
                        {inc.type === "percentage" ? "Percentage" : "Fixed amount"}
                      </td>
                      <td style={{ padding: "12px" }}>
                        {inc.type === "percentage"
                          ? `${inc.amount}% of product value`
                          : `₹ ${inc.amount}`}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <div className="font12">
                          Leads + orders target:{" "}
                          <span className="fontSemiBold">
                            {inc.targetLeads || 0}
                          </span>
                          {report && (
                            <span className="grayText">
                              {" "}(actual: {(report.orderCount || 0) + (report.leadCount || 0)})
                            </span>
                          )}
                        </div>
                        <div className="font12">
                          Revenue target:{" "}
                          <span className="fontSemiBold">
                            ₹ {(inc.targetRevenue || 0).toLocaleString("en-IN")}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: "12px",
                            backgroundColor: inc.meetsTargets ? "#28a745" : "#6c757d",
                            color: "#fff",
                            fontSize: "12px",
                          }}
                        >
                          {inc.meetsTargets ? "Targets met" : "Not met"}
                        </span>
                      </td>
                      <td style={{ padding: "12px" }}>
                        ₹ {Math.round(inc.payout || 0).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                  {(!report.incentives || report.incentives.length === 0) && (
                    <tr>
                      <td colSpan={6} style={{ padding: "16px", textAlign: "center" }}>
                        <span className="font14 grayText">
                          No active incentives found for this period.
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {(report.orders || []).length > 0 && (
            <div className="appendTop24">
              <h2 className="listTitle font20 fontBold blackText appendBottom8">
                Orders
              </h2>
              <p className="font14 grayText appendBottom16">
                Paid orders contributing to revenue. Product value is subtotal minus discount,
                excluding GST, shipping and other charges.
              </p>
              <div className="brandsListTable">
                <div className="tableContainer" style={{ overflowX: "auto" }}>
                  <table className="brandsTable" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f5f5f5" }}>
                        <th style={{ padding: "12px", textAlign: "left" }}>Date</th>
                        <th style={{ padding: "12px", textAlign: "left" }}>Order ID</th>
                        <th style={{ padding: "12px", textAlign: "left" }}>Subtotal (₹)</th>
                        <th style={{ padding: "12px", textAlign: "left" }}>Discount (₹)</th>
                        <th style={{ padding: "12px", textAlign: "left" }}>Product value (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.orders.map((o) => (
                        <tr key={o.orderId} style={{ borderBottom: "1px solid #e0e0e0" }}>
                          <td style={{ padding: "12px" }}>
                            {o.createdAt
                              ? new Date(o.createdAt).toLocaleDateString("en-IN")
                              : "-"}
                          </td>
                          <td style={{ padding: "12px" }}>
                            {o.orderNumber || o.orderId}
                          </td>
                          <td style={{ padding: "12px" }}>
                            {Math.round(o.subtotal || 0).toLocaleString("en-IN")}
                          </td>
                          <td style={{ padding: "12px" }}>
                            {Math.round(o.discount || 0).toLocaleString("en-IN")}
                          </td>
                          <td style={{ padding: "12px", fontWeight: 600 }}>
                            {Math.round(o.netSubtotal || 0).toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <div className="appendTop24">
            <h2 className="listTitle font20 fontBold blackText appendBottom8">
              Closed / converted leads
              {report.agentName && (
                <span className="font14 grayText" style={{ fontWeight: 400, marginLeft: 8 }}>
                  — {report.agentName}
                </span>
              )}
            </h2>
            <p className="font14 grayText appendBottom16">
              Leads with status "closed" or "active" (converted) in the selected period
              contribute to lead targets and revenue.
            </p>
            <div className="brandsListTable">
              <div className="tableContainer" style={{ overflowX: "auto" }}>
                <table className="brandsTable" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f5f5f5" }}>
                      <th style={{ padding: "12px", textAlign: "left" }}>Closed date</th>
                      <th style={{ padding: "12px", textAlign: "left" }}>Name</th>
                      <th style={{ padding: "12px", textAlign: "left" }}>Company</th>
                      <th style={{ padding: "12px", textAlign: "left" }}>Agent</th>
                      <th style={{ padding: "12px", textAlign: "left" }}>Website</th>
                      <th style={{ padding: "12px", textAlign: "left" }}>Status</th>
                      <th style={{ padding: "12px", textAlign: "left" }}>Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report.leads || []).map((l) => (
                      <tr key={l.leadId} style={{ borderBottom: "1px solid #e0e0e0" }}>
                        <td style={{ padding: "12px" }}>
                          {l.closedAt
                            ? new Date(l.closedAt).toLocaleDateString("en-IN")
                            : "-"}
                        </td>
                        <td style={{ padding: "12px" }}>
                          {l.name}
                        </td>
                        <td style={{ padding: "12px" }}>
                          {l.company || "-"}
                        </td>
                        <td style={{ padding: "12px" }}>
                          {l.agentName || "-"}
                        </td>
                        <td style={{ padding: "12px" }}>
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: "12px",
                              backgroundColor: "#f0f0f0",
                              fontSize: "11px",
                            }}
                          >
                            {l.websiteName || "-"}
                          </span>
                        </td>
                        <td style={{ padding: "12px" }}>
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: "12px",
                              backgroundColor: l.status === "closed" ? "#28a745" : "#17a2b8",
                              color: "#fff",
                              fontSize: "11px",
                              textTransform: "capitalize",
                            }}
                          >
                            {l.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px", fontWeight: 600 }}>
                          {Math.round(l.actualValue || l.estimatedValue || 0).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                    {(!report.leads || report.leads.length === 0) && (
                      <tr>
                        <td colSpan={7} style={{ padding: "16px", textAlign: "center" }}>
                          <span className="font14 grayText">
                            No closed / converted leads found for this period.
                          </span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default IncentiveReport

