import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

const WebsiteSelection = () => {
  const [websites, setWebsites] = useState([]);
  const [selectedWebsite, setSelectedWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasFullAccess, setHasFullAccess] = useState(false);
  const [noAccessMessage, setNoAccessMessage] = useState("");
  const { user, setSelectedWebsite: setWebsiteInContext, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!user) {
      navigate("/", { replace: true });
      return;
    }

    // Fetch accessible websites for the current user
    const fetchAccessibleWebsites = async () => {
      try {
        setLoading(true);
        setError("");
        setNoAccessMessage("");
        
        // Use the new endpoint that filters websites based on user access
        const response = await api.get("/user-access/my-websites");
        const { websites: accessibleWebsites, hasFullAccess: fullAccess, message } = response.data;
        
        setWebsites(accessibleWebsites || []);
        setHasFullAccess(fullAccess);
        
        if (message) {
          setNoAccessMessage(message);
        }
        
        // If user only has access to one website, auto-select it
        if (accessibleWebsites?.length === 1) {
          setSelectedWebsite(accessibleWebsites[0]._id);
        }
      } catch (err) {
        console.error("Error fetching accessible websites:", err);
        setError("Failed to load websites. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchAccessibleWebsites();
  }, [user, navigate]);

  const handleGo = () => {
    if (!selectedWebsite) {
      setError("Please select a website/domain");
      return;
    }

    const website = websites.find((w) => w._id === selectedWebsite);
    if (website) {
      // Store selected website in context
      setWebsiteInContext(website);
      // Navigate to dashboard
      navigate("/dashboard", { replace: true });
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 10000,
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "40px",
          borderRadius: "8px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
          minWidth: "400px",
          maxWidth: "500px",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            marginBottom: "30px",
            fontSize: "24px",
            fontWeight: "bold",
            color: "#333",
          }}
        >
          Select Website/Domain
        </h2>

        {loading ? (
          <div style={{ padding: "20px" }}>
            <p>Loading websites...</p>
          </div>
        ) : websites.length === 0 ? (
          <div style={{ padding: "20px" }}>
            <p style={{ color: "#666", marginBottom: "10px" }}>
              {noAccessMessage || "No websites available."}
            </p>
            <p style={{ color: "#999", fontSize: "14px", marginBottom: "20px" }}>
              Please contact your administrator to get website access.
            </p>
            <button
              onClick={() => {
                // Use logout function from context
                if (logout) logout();
                navigate("/", { replace: true });
              }}
              style={{
                padding: "10px 20px",
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: "20px" }}>
              <select
                value={selectedWebsite}
                onChange={(e) => {
                  setSelectedWebsite(e.target.value);
                  setError("");
                }}
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: "16px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  backgroundColor: "white",
                  cursor: "pointer",
                }}
              >
                <option value="">-- Select Website/Domain --</option>
                {websites.map((website) => (
                  <option key={website._id} value={website._id}>
                    {website.name} ({website.domain})
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p
                style={{
                  color: "#dc3545",
                  marginBottom: "20px",
                  fontSize: "14px",
                }}
              >
                {error}
              </p>
            )}

            <button
              onClick={handleGo}
              disabled={!selectedWebsite || loading}
              style={{
                width: "100%",
                padding: "12px",
                fontSize: "16px",
                fontWeight: "bold",
                backgroundColor: selectedWebsite ? "#007bff" : "#ccc",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: selectedWebsite ? "pointer" : "not-allowed",
                transition: "background-color 0.3s",
              }}
              onMouseEnter={(e) => {
                if (selectedWebsite) {
                  e.target.style.backgroundColor = "#0056b3";
                }
              }}
              onMouseLeave={(e) => {
                if (selectedWebsite) {
                  e.target.style.backgroundColor = "#007bff";
                }
              }}
            >
              Go
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default WebsiteSelection;
