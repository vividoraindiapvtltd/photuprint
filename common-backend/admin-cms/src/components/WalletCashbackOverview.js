import React from "react"
import { NavLink } from "react-router-dom"
import { PageHeader } from "../common"

/**
 * Landing page for Wallet & cashback section — links to rules and ledger tools.
 */
export default function WalletCashbackOverview() {
  const card = {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: "1rem 1.25rem",
    background: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  }
  const linkStyle = { color: "#007bff", fontWeight: 600, textDecoration: "none" }

  return (
    <div className="rightContainer" style={{ padding: "1.5rem" }}>
      <PageHeader title="Wallet & cashback" subtitle="Configure rules and inspect customer wallets for the selected website." />

      <div style={{ display: "grid", gap: "1rem", maxWidth: 720 }}>
        <div style={card}>
          <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.05rem" }}>How it works</h3>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#374151", lineHeight: 1.6 }}>
            <li>Cashback percentage is resolved per line: product rule → category rule → default rule.</li>
            <li>Cashback is credited to the customer wallet only after the order is marked delivered.</li>
            <li>Credited amounts can expire after the number of days set on the matching rule.</li>
            <li>Refunds and returns reverse credited cashback where possible; wallet payments used on an order are refunded to the wallet.</li>
            <li>Checkout can split payment between wallet balance and other methods when the storefront sends the right fields.</li>
          </ul>
        </div>

        <div style={{ ...card, display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}>
          <span style={{ color: "#374151" }}>Go to:</span>
          <NavLink to="/dashboard/wallet-cashback/rules" style={linkStyle}>
            Cashback rules
          </NavLink>
          <span style={{ color: "#d1d5db" }}>|</span>
          <NavLink to="/dashboard/wallet-cashback/ledger" style={linkStyle}>
            Wallet ledger
          </NavLink>
        </div>
      </div>
    </div>
  )
}
