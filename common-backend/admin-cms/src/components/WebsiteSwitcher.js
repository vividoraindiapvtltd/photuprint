import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

/**
 * WebsiteSwitcher - Super admin only
 * Allows super admin to switch the active website without logging out.
 * Changing website updates context and reloads the dashboard.
 */
const WebsiteSwitcher = () => {
  const { user, selectedWebsite, setSelectedWebsite } = useAuth();
  const [websites, setWebsites] = useState([]);
  const [loading, setLoading] = useState(false);

  const isSuperAdmin =
    user?.user?.role === "super_admin" || user?.user?.isSuperAdmin === true;

  useEffect(() => {
    if (!isSuperAdmin) return;

    const fetchWebsites = async () => {
      try {
        setLoading(true);
        const response = await api.get("/user-access/my-websites");
        const { websites: list } = response.data;
        setWebsites(list || []);
      } catch (err) {
        console.error("Error fetching websites for switcher:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchWebsites();
  }, [isSuperAdmin]);

  const handleChange = (e) => {
    const websiteId = e.target.value;
    if (!websiteId) return;
    const website = websites.find((w) => w._id === websiteId);
    if (website) {
      setSelectedWebsite(website);
      window.location.reload();
    }
  };

  if (!isSuperAdmin) return null;

  const selectStyle = {
    padding: "8px 12px",
    fontSize: "14px",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    backgroundColor: "white",
    cursor: "pointer",
    fontWeight: 500,
    maxWidth: "220px",
  };

  if (loading) {
    return (
      <select disabled style={selectStyle}>
        <option>Loading websites...</option>
      </select>
    );
  }

  if (websites.length === 0) {
    return (
      <span style={{ fontSize: "14px", color: "#6b7280" }}>No websites</span>
    );
  }

  return (
    <select
      value={selectedWebsite?._id || ""}
      onChange={handleChange}
      style={selectStyle}
      title="Switch website"
    >
      {websites.map((website) => (
        <option key={website._id} value={website._id}>
          {website.name} ({website.domain})
        </option>
      ))}
    </select>
  );
};

export default WebsiteSwitcher;
