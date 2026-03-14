import React, { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import IconMap from "../common/IconMap";
import photuprintLogo from "../images/spacer.gif";
import { usePermissions } from "../context/PermissionContext";

/**
 * Sidebar accordion groups: label + list of path suffixes (matched against item.link).
 * Order of groups defines sidebar order.
 */
const SIDEBAR_GROUPS = [
  {
    label: "Catalog",
    links: ["/dashboard/addbrand", "/dashboard/addcategory", "/dashboard/addsubcategory", "/dashboard/variationmanager", "/dashboard/addproducts", "/dashboard/aplus-content"],
  },
  {
    label: "Product attributes",
    links: ["/dashboard/addcollarstyle", "/dashboard/addcolor", "/dashboard/addcountryoforigin", "/dashboard/addfittype", "/dashboard/addprintingtype", "/dashboard/addheight", "/dashboard/addlength", "/dashboard/addmaterial", "/dashboard/addpattern", "/dashboard/addpincode", "/dashboard/addsize", "/dashboard/addsleevetype", "/dashboard/addwidth"],
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
    label: "Reports",
    links: [
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
    label: "Lead Management",
    links: ["/dashboard/clients", "/dashboard/adduser?role=editor", "/dashboard/leads-download", "/dashboard/incentives", "/dashboard/incentive-report"],
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
];

/**
 * LeftContainer Component
 *
 * Renders the sidebar navigation menu with accordion groups.
 * Filters menu items based on user permissions using RBAC.
 * Super Admin sees all menu items.
 */
const LeftContainer = ({ data }) => {
  const { filterMenuItems, loading } = usePermissions();
  const [expandedGroups, setExpandedGroups] = useState(() =>
    SIDEBAR_GROUPS.reduce((acc, _, i) => ({ ...acc, [i]: true }), {})
  );

  const filteredData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    return filterMenuItems(data);
  }, [data, filterMenuItems]);

  const linkToItem = useMemo(() => {
    const map = {};
    (filteredData || []).forEach((item) => {
      if (item && item.link) map[item.link] = item;
    });
    return map;
  }, [filteredData]);

  const toggleGroup = (index) => {
    setExpandedGroups((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  if (loading) {
    return (
      <div className="sidebarContainer" style={{ width: 237 }}>
        <div className="top">
          <div className="logo">
            <img src={photuprintLogo} alt="Logo" />
          </div>
        </div>
        <div style={{ padding: "1rem", color: "#666" }}>Loading menu...</div>
      </div>
    );
  }

  return (
    <div className="sidebarContainer" style={{ width: 237 }}>
      <div className="top">
        <div className="logo">
          <img src={photuprintLogo} alt="Logo" />
        </div>
      </div>
      <div className="sidebar">
        {SIDEBAR_GROUPS.map((group, groupIndex) => {
          const visibleLinks = group.links.filter((path) => linkToItem[path]);
          if (visibleLinks.length === 0) return null;
          const isExpanded = expandedGroups[groupIndex];
          return (
            <div key={groupIndex} className="sidebarAccordion">
              <button
                type="button"
                className="sidebarAccordionHeader"
                onClick={() => toggleGroup(groupIndex)}
                aria-expanded={isExpanded}
              >
                <span className="sidebarAccordionLabel">{group.label}</span>
                <span className="sidebarAccordionIcon">{isExpanded ? "\u25B2" : "\u25BC"}</span>
              </button>
              <div
                className="sidebarAccordionContent"
                data-expanded={isExpanded}
              >
                {visibleLinks.map((path) => {
                  const item = linkToItem[path];
                  if (!item) return null;
                  return (
                    <NavLink
                      key={item.id || path}
                      to={item.link}
                      className={({ isActive }) => (isActive ? "active navLink" : "navLink")}
                      end={item.link !== "/dashboard"}
                    >
                      <IconMap name={item.icon} size={22} />
                      <span>{item.title}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LeftContainer;
