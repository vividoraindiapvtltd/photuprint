import React from "react"
import { NavLink, Outlet } from "react-router-dom"
import { PageHeader } from "../common"

const tabs = [
  { to: "/dashboard/pixelcraft", end: true, label: "Templates", icon: "🖼️" },
  { to: "/dashboard/pixelcraft/elements", end: false, label: "Element Manager", icon: "📦" },
  { to: "/dashboard/pixelcraft/element-images", end: false, label: "Element Images", icon: "🖼️" },
  { to: "/dashboard/pixelcraft/dimensions", end: false, label: "Dimensions", icon: "📐" },
  { to: "/dashboard/pixelcraft/fonts", end: false, label: "Fonts", icon: "🔤" },
  { to: "/dashboard/pixelcraft/image-to-vector", end: false, label: "Image to Vector", icon: "🔄" },
]

export default function PixelCraft() {
  return (
    <div className="paddingAll20">
      {/* Header - outside container, same as BrandManager */}
      <PageHeader title="PixelCraft" subtitle="Template platform blueprint & reference code" />

      <div className="brandFormContainer paddingAll32 appendBottom30">
        {/* Tabs - same style as ShippingCostManager */}
        <div
          style={{
            display: "flex",
            gap: 0,
            borderBottom: "2px solid #e5e7eb",
            marginBottom: "24px",
            marginTop: 0,
            marginLeft: "-32px",
            marginRight: "-32px",
          }}
        >
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              style={({ isActive }) => ({
                padding: "12px 24px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: isActive ? "600" : "400",
                color: isActive ? "#007bff" : "#666",
                borderBottom: isActive ? "3px solid #007bff" : "3px solid transparent",
                marginBottom: "-2px",
                transition: "all 0.2s",
                textDecoration: "none",
              })}
            >
              {tab.icon} {tab.label}
            </NavLink>
          ))}
        </div>

        <Outlet />
      </div>
    </div>
  )
}

