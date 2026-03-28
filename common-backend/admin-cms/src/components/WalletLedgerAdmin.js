import React, { useMemo, useState } from "react"
import api from "../api/axios"
import { PageHeader, AlertMessage } from "../common"

function formatDateInput(d) {
  const x = new Date(d)
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, "0")
  const day = String(x.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Default range: last 30 days (local calendar) */
function defaultToDate() {
  return formatDateInput(new Date())
}

function defaultFromDate() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return formatDateInput(d)
}

export default function WalletLedgerAdmin() {
  const [userId, setUserId] = useState("")
  const [fromDate, setFromDate] = useState(defaultFromDate)
  const [toDate, setToDate] = useState(defaultToDate)
  const [balance, setBalance] = useState(null)
  const [entries, setEntries] = useState([])
  const [cashbackEntries, setCashbackEntries] = useState([])
  const [rangeMeta, setRangeMeta] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const cashbackAssignedTotal = useMemo(() => {
    return cashbackEntries
      .filter((r) => r.reason === "cashback_order_delivered" && Number(r.amount) > 0)
      .reduce((sum, r) => sum + Number(r.amount || 0), 0)
  }, [cashbackEntries])

  const loadData = async (e) => {
    e?.preventDefault()
    const id = userId.trim()
    if (!id) {
      setError("Enter a user ID")
      return
    }
    const f = fromDate?.trim() || ""
    const t = toDate?.trim() || ""
    if (f && t && f > t) {
      setError("From date cannot be after To date")
      return
    }
    setLoading(true)
    setError("")
    setBalance(null)
    setEntries([])
    setCashbackEntries([])
    setRangeMeta(null)
    try {
      const params = {
        userId: id,
        limit: 200,
        skip: 0,
      }
      if (f) params.fromDate = f
      if (t) params.toDate = t

      const [balRes, ledRes] = await Promise.all([
        api.get("/wallet/balance", { params: { userId: id } }),
        api.get("/wallet/ledger", { params }),
      ])
      setBalance(balRes.data)
      setEntries(ledRes.data?.entries || [])
      setCashbackEntries(ledRes.data?.cashbackEntries || [])
      setRangeMeta({
        fromDate: ledRes.data?.fromDate ?? (f || null),
        toDate: ledRes.data?.toDate ?? (t || null),
      })
    } catch (err) {
      setError(err.response?.data?.msg || err.message || "Request failed")
    } finally {
      setLoading(false)
    }
  }

  const thtd = { border: "1px solid #e5e7eb", padding: "0.45rem 0.5rem", textAlign: "left", fontSize: "0.85rem" }

  const renderRow = (row) => (
    <tr key={row._id}>
      <td style={thtd}>{row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}</td>
      <td style={thtd}>{row.order?.orderNumber != null && row.order?.orderNumber !== "" ? row.order.orderNumber : "—"}</td>
      <td style={thtd}>{row.amount}</td>
      <td style={thtd}>{row.balanceAfter}</td>
      <td style={thtd}>{row.reason}</td>
      <td style={thtd} title={row.idempotencyKey}>
        {row.idempotencyKey ? `${String(row.idempotencyKey).slice(0, 28)}…` : "—"}
      </td>
      <td style={thtd}>{row.expiresAt ? new Date(row.expiresAt).toLocaleDateString() : "—"}</td>
    </tr>
  )

  return (
    <div className="rightContainer" style={{ padding: "1.5rem" }}>
      <PageHeader
        title="Wallet ledger"
        subtitle="Look up balance and ledger lines for a customer by MongoDB user id. Filter by date range; cashback assigned is listed separately."
      />

      {error ? <AlertMessage type="error" message={error} onClose={() => setError("")} /> : null}

      <form
        onSubmit={loadData}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "flex-end",
          marginBottom: "1rem",
        }}
      >
        <div style={{ flex: "1 1 220px" }}>
          <label className="formLabel">User ID</label>
          <input
            className="formInput"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="507f1f77bcf86cd799439011"
          />
        </div>
        <div style={{ flex: "0 1 160px" }}>
          <label className="formLabel">From date</label>
          <input className="formInput" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div style={{ flex: "0 1 160px" }}>
          <label className="formLabel">To date</label>
          <input className="formInput" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <button type="submit" className="btnPrimary" disabled={loading}>
          {loading ? "Loading…" : "Load"}
        </button>
        <button
          type="button"
          onClick={() => {
            setFromDate("")
            setToDate("")
          }}
          style={{
            padding: "0.55rem 1rem",
            background: "#fff",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Clear dates
        </button>
      </form>

      <p style={{ color: "#6b7280", fontSize: "0.9rem", marginBottom: "1rem" }}>
        Tip: use <strong>Clear dates</strong> then Load to fetch the latest 200 lines with no date filter. Default is
        the last 30 days.
      </p>

      {balance != null && (
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "#ecfdf5",
            border: "1px solid #6ee7b7",
            borderRadius: 8,
            marginBottom: "1rem",
            fontWeight: 600,
          }}
        >
          Current balance: {balance.balance} {balance.currency || "INR"}
        </div>
      )}

      {rangeMeta && (rangeMeta.fromDate || rangeMeta.toDate) && (
        <p style={{ fontSize: "0.9rem", color: "#374151", marginBottom: "0.5rem" }}>
          Filter: {rangeMeta.fromDate || "…"} → {rangeMeta.toDate || "…"} (UTC day boundaries)
        </p>
      )}

      {balance != null && !loading && (
        <div style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.05rem" }}>Cashback (assigned &amp; adjustments)</h3>
          <p style={{ margin: "0 0 0.75rem", color: "#6b7280", fontSize: "0.9rem" }}>
            Includes credits on delivery, reversals on refund, and expiry debits. Order column shows the linked order when
            present.
          </p>
          {cashbackEntries.length > 0 ? (
            <>
              <p style={{ margin: "0 0 0.75rem", color: "#059669", fontWeight: 600 }}>
                Total cashback credited in range: {cashbackAssignedTotal.toFixed(2)} {balance?.currency || "INR"}
                <span style={{ fontWeight: 400, color: "#6b7280", marginLeft: "0.5rem" }}>
                  (sum of cashback_order_delivered lines)
                </span>
              </p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#ecfdf5" }}>
                      <th style={thtd}>Date</th>
                      <th style={thtd}>Order</th>
                      <th style={thtd}>Amount</th>
                      <th style={thtd}>Balance after</th>
                      <th style={thtd}>Reason</th>
                      <th style={thtd}>Idempotency key</th>
                      <th style={thtd}>Expires</th>
                    </tr>
                  </thead>
                  <tbody>{cashbackEntries.map(renderRow)}</tbody>
                </table>
              </div>
            </>
          ) : (
            <p style={{ color: "#6b7280", margin: 0 }}>No cashback-related lines in the selected range.</p>
          )}
        </div>
      )}

      {entries.length > 0 && (
        <div>
          <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.05rem" }}>All wallet ledger entries</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th style={thtd}>Date</th>
                  <th style={thtd}>Order</th>
                  <th style={thtd}>Amount</th>
                  <th style={thtd}>Balance after</th>
                  <th style={thtd}>Reason</th>
                  <th style={thtd}>Idempotency key</th>
                  <th style={thtd}>Expires</th>
                </tr>
              </thead>
              <tbody>{entries.map(renderRow)}</tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && balance != null && entries.length === 0 && (
        <p style={{ color: "#6b7280" }}>No ledger lines in this range and filters.</p>
      )}
    </div>
  )
}
