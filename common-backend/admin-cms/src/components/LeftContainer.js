import React, { useMemo, useState } from "react"
import { NavLink } from "react-router-dom"
import IconMap from "../common/IconMap"
// import photuprintLogo from "../images/Photu-Print-Logo-1.jpg"
import photuprintLogo from "../images/spacer.gif"
import { usePermissions } from "../context/PermissionContext"

/**
 * Sidebar accordion groups: label + list of path suffixes (matched against item.link).
 * Order of groups defines sidebar order.
 */
const SIDEBAR_GROUPS = [
  {
    label: "Catalog",
    links: ["/dashboard/addbrand", "/dashboard/addcategory", "/dashboard/addsubcategory", "/dashboard/variationmanager", "/dashboard/addproducts"],
  },
  {
    label: "Product attributes",
    links: ["/dashboard/addcollarstyle", "/dashboard/addcolor", "/dashboard/addcountryoforigin", "/dashboard/addfittype", "/dashboard/addcapacity", "/dashboard/addgsm", "/dashboard/addprintingtype", "/dashboard/addprintside", "/dashboard/addproductaddon", "/dashboard/addheight", "/dashboard/addlength", "/dashboard/addmaterial", "/dashboard/addpattern", "/dashboard/addpincode", "/dashboard/addsize", "/dashboard/addsleevetype", "/dashboard/addwidth"],
  },
  {
    label: "Homepage Setting",
    links: ["/dashboard/homepage-sections", "/dashboard/frontend", "/dashboard/footer-sections", "/dashboard/footer-settings", "/dashboard/testimonialmanager"],
  },
  {
    label: "Content & marketing",
    links: ["/dashboard/reviewmanager", "/dashboard/addcoupon", "/dashboard/templatemanager"],
  },
  {
    label: "Orders & shipping",
    links: ["/dashboard/addorder", "/dashboard/addshipping", "/dashboard/shipping-cost-manager", "/dashboard/product-cost-calculator"],
  },
  {
    label: "Wallet & cashback",
    links: [
      "/dashboard/wallet-cashback",
      "/dashboard/wallet-cashback/rules",
      "/dashboard/wallet-cashback/ledger",
    ],
  },
  {
    label: "Lead Management",
    links: [
      "/dashboard/clients",
      "/dashboard/adduser?role=editor",
      "/dashboard/leads-download",
      "/dashboard/incentives",
      "/dashboard/incentive-report",
    ],
  },
  {
    label: "Reports",
    links: [
      // "/dashboard/reports",
      "/dashboard/reports/sales-summary",
      "/dashboard/reports/order-wise-sales",
      "/dashboard/reports/product-wise-sales",
      "/dashboard/reports/category-wise-sales",
      "/dashboard/reports/customer-overview",
      "/dashboard/reports/customer-purchase",
      "/dashboard/reports/customer-lifetime-value",
      "/dashboard/reports/inventory-stock",
      "/dashboard/reports/inventory-valuation",
      "/dashboard/reports/payment-method",
      "/dashboard/reports/refund-cancellation",
      "/dashboard/reports/tax",
      "/dashboard/reports/coupon-usage",
      "/dashboard/reports/shipping-performance",
      "/dashboard/reports/admin-activity",
    ],
  },
  {
    label: "Users & access",
    links: ["/dashboard/adduser", "/dashboard/user-access"],
  },
  {
    label: "Settings",
    links: ["/dashboard/addgstslab", "/dashboard/addcompany", "/dashboard/addwebsite"],
  },
  {
    label: "PixelCraft",
    links: ["/dashboard/pixelcraft", "/dashboard/pixelcraft/elements", "/dashboard/pixelcraft/element-images", "/dashboard/pixelcraft/dimensions", "/dashboard/pixelcraft/image-to-vector"],
  },
]

/**
 * LeftContainer Component
 *
 * Renders the sidebar navigation menu with accordion groups.
 * Filters menu items based on user permissions using RBAC.
 * Super Admin sees all menu items.
 */
const LeftContainer = ({ data }) => {
  const { filterMenuItems, isSuperAdmin, loading } = usePermissions()
  const [expandedGroups, setExpandedGroups] = useState(() =>
    SIDEBAR_GROUPS.reduce((acc, _, i) => ({ ...acc, [i]: true }), {})
  )

  const filteredData = useMemo(() => {
    if (loading) return []
    return filterMenuItems(data)
  }, [data, filterMenuItems, loading])

  const linkToItem = useMemo(() => {
    const map = {}
    filteredData.forEach((item) => {
      map[item.link] = item
    })
    return map
  }, [filteredData])

  const grouped = useMemo(() => {
    return SIDEBAR_GROUPS.map((group) => ({
      label: group.label,
      items: group.links.map((link) => linkToItem[link]).filter(Boolean),
    }))
  }, [linkToItem])

  const toggleGroup = (index) => {
    setExpandedGroups((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  return (
    <aside className="sidebarContainer">
      <div className="top">
        <div className="logo">
          <img src={photuprintLogo} alt="PhotuPrint" className="logoStyle textLogo" />
        </div>
        <div className="close">✖</div>
      </div>

      <div className="sidebar">
        {isSuperAdmin && (
          <div className="superAdminBadge" style={{
            padding: "8px 12px",
            margin: "0 10px 10px",
            background: "linear-gradient(135deg, #dc3545 0%, #c82333 100%)",
            borderRadius: "6px",
            color: "#fff",
            fontSize: "11px",
            fontWeight: "600",
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}>
            🔐 Super Admin
          </div>
        )}

        {grouped.map((group, index) => {
          const isExpanded = expandedGroups[index] !== false
          return (
            <div key={group.label} className="sidebarAccordion">
              <button
                type="button"
                className="sidebarAccordionHeader"
                onClick={() => toggleGroup(index)}
                aria-expanded={isExpanded}
              >
                <span className="sidebarAccordionLabel">{group.label}</span>
                <span className="sidebarAccordionIcon" aria-hidden>{isExpanded ? "▼" : "▶"}</span>
              </button>
              <div className="sidebarAccordionContent" data-expanded={isExpanded}>
                {group.items.length === 0 ? (
                  <div className="sidebarAccordionEmpty">No items yet</div>
                ) : (
                  group.items.map((item) => (
                    <NavLink
                      key={`${item.id}-${item.link}`}
                      to={item.link}
                      className={({ isActive }) => `navLink ${isActive ? "active" : ""}`}
                    >
                      <IconMap name={item.icon} size={22} />
                      <span>{item.title}</span>
                    </NavLink>
                  ))
                )}
              </div>
            </div>
          )
        })}

        {filteredData.length === 0 && !loading && (
          <div className="noMenuItems" style={{
            padding: "20px",
            textAlign: "center",
            color: "#6c757d",
            fontSize: "13px",
          }}>
            No accessible menu items.
            <br />
            Contact your administrator.
          </div>
        )}
      </div>
    </aside>
  )
}

export default LeftContainer
