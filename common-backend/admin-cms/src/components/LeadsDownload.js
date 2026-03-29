import React, { useState, useEffect, useCallback } from "react";
import api from "../api/axios";
import { usePermissions } from "../context/PermissionContext";
import { PageHeader, AlertMessage, FormField } from "../common";
import "../css/styles.css";

const PERIOD_OPTIONS = [
  { value: "day", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
];

const FORMAT_OPTIONS = [
  { value: "csv", label: "CSV" },
  { value: "xlsx", label: "Excel" },
  { value: "pdf", label: "PDF" },
];

const LeadsDownload = () => {
  const { isSuperAdmin } = usePermissions();
  const [salesAgents, setSalesAgents] = useState([]);
  const [websites, setWebsites] = useState([]);
  const [period, setPeriod] = useState("month");
  const [format, setFormat] = useState("csv");
  const [assignedTo, setAssignedTo] = useState("all");
  const [leadWebsiteFilter, setLeadWebsiteFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [leadsList, setLeadsList] = useState([]);
  const [listLoading, setListLoading] = useState(false);

  const getExportRequestConfig = () => {
    if (isSuperAdmin && leadWebsiteFilter === "all") return { skipWebsiteId: true };
    if (isSuperAdmin && leadWebsiteFilter && leadWebsiteFilter !== "all") return { websiteId: leadWebsiteFilter };
    return {};
  };

  useEffect(() => {
    const fetchSalesAgents = async () => {
      try {
        const config = isSuperAdmin ? { params: { role: "editor" }, skipWebsiteId: true } : { params: { role: "editor" } };
        const response = await api.get("/users", config);
        setSalesAgents(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error("Error fetching sales agents:", err);
        setSalesAgents([]);
      }
    };
    fetchSalesAgents();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const fetchWebsites = async () => {
      try {
        const response = await api.get("/websites", { skipWebsiteId: true });
        setWebsites(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error("Error fetching websites:", err);
        setWebsites([]);
      }
    };
    fetchWebsites();
  }, [isSuperAdmin]);

  const fetchLeadsList = useCallback(async () => {
    try {
      setListLoading(true);
      const params = {
        period,
        showInactive: "true",
        includeDeleted: "false",
        limit: 500,
        page: 1,
      };
      if (assignedTo && assignedTo !== "all") params.assignedTo = assignedTo;
      const config = { params, ...getExportRequestConfig() };
      const response = await api.get("/clients", config);
      setLeadsList(response.data?.clients ?? []);
    } catch (err) {
      console.error("Error fetching leads list:", err);
      setLeadsList([]);
    } finally {
      setListLoading(false);
    }
  }, [period, assignedTo, isSuperAdmin, leadWebsiteFilter]);

  useEffect(() => {
    fetchLeadsList();
  }, [fetchLeadsList]);

  const handleDownload = async () => {
    setError("");
    setSuccess("");
    try {
      setLoading(true);
      const params = { period, format };
      if (assignedTo && assignedTo !== "all") params.assignedTo = assignedTo;
      const config = {
        params,
        responseType: "blob",
        ...getExportRequestConfig(),
      };
      const response = await api.get("/clients/export", config);
      const disposition = response.headers["content-disposition"];
      const ext = format === "pdf" ? "pdf" : format === "xlsx" ? "xlsx" : "csv";
      let filename = `leads-export.${ext}`;
      if (disposition) {
        const match = /filename="?([^";\n]+)"?/.exec(disposition);
        if (match) filename = match[1].trim();
      }
      const url = URL.createObjectURL(response.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccess("Leads downloaded successfully.");
    } catch (err) {
      console.error("Export error:", err);
      setError(err.response?.data?.msg || "Failed to download leads. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const websiteOptions = [
    { value: "all", label: "All websites" },
    ...websites.map((w) => ({ value: w._id, label: w.name || w.domain || w._id })),
  ];
  const agentOptions = [
    { value: "all", label: "All agents" },
    ...salesAgents.map((a) => ({ value: a._id, label: a.name || a.email || a._id })),
  ];

  return (
    <div className="paddingAll20">
      <PageHeader
        title="Download leads"
        subtitle="View and download leads by period and sales agent"
      />

      <AlertMessage
        type="success"
        message={success}
        onClose={() => setSuccess("")}
        autoClose={true}
      />
      <AlertMessage
        type="error"
        message={error}
        onClose={() => setError("")}
        autoClose={true}
      />

      <div className="brandFormContainer paddingAll32 appendBottom30">
        <div className="brandForm">
          <div className="makeFlex row gap10 appendBottom16">
            {isSuperAdmin && (
              <div className="flexOne">
                <FormField
                  type="select"
                  name="leadWebsiteFilter"
                  label="Leads from"
                  value={leadWebsiteFilter}
                  onChange={(e) => setLeadWebsiteFilter(e.target.value)}
                  options={websiteOptions}
                  info="Choose which website's leads to export"
                />
              </div>
            )}
            <div className={isSuperAdmin ? "flexOne" : "fullWidth"}>
              <FormField
                type="select"
                name="period"
                label="Period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                options={PERIOD_OPTIONS}
                info="Time range for the leads to include in the export"
              />
            </div>
          </div>

          <div className="makeFlex row gap10 appendBottom16">
            <div className="flexOne">
              <FormField
                type="select"
                name="assignedTo"
                label="Sales agent"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                options={agentOptions}
                info="Filter by assigned sales agent or export all"
              />
            </div>
            <div className="flexOne">
              <FormField
                type="select"
                name="format"
                label="Download format"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                options={FORMAT_OPTIONS}
                info="Choose PDF, Excel, or CSV"
              />
            </div>
          </div>

          <div className="formActions paddingTop16">
            <button
              type="button"
              onClick={handleDownload}
              disabled={loading}
              className="btnPrimary"
            >
              {loading ? (
                <span className="loadingSpinner">⏳</span>
              ) : (
                <span>Download {format === "pdf" ? "PDF" : format === "xlsx" ? "Excel" : "CSV"}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <h2 className="listTitle font30 fontBold blackText appendBottom0">
            Leads ({listLoading ? "…" : leadsList.length})
          </h2>
          {listLoading && <div className="loadingIndicator grayText">Loading…</div>}
        </div>
        {listLoading && leadsList.length === 0 ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">📋</div>
            <p className="font16 grayText">Loading leads…</p>
          </div>
        ) : leadsList.length === 0 ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">📋</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No leads found</h3>
            <p className="font16 grayText">Adjust Leads from, Period, or Sales agent and the list will update.</p>
          </div>
        ) : (
          <div className="tableContainer">
            <table className="brandsTable">
              <thead>
                <tr>
                  <th className="tableHeader">Client ID</th>
                  <th className="tableHeader">Name</th>
                  <th className="tableHeader">Email</th>
                  <th className="tableHeader">Phone</th>
                  <th className="tableHeader">Company</th>
                  <th className="tableHeader">Product</th>
                  <th className="tableHeader">Qty</th>
                  <th className="tableHeader">Status</th>
                  <th className="tableHeader">Assigned to</th>
                  <th className="tableHeader">Created</th>
                </tr>
              </thead>
              <tbody>
                {leadsList.map((c) => (
                  <tr key={c._id} className="tableRow">
                    <td className="tableCell font14 blackText">{c.clientId || "—"}</td>
                    <td className="tableCell font14 blackText">
                      {[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="tableCell font14 blackText">{c.email || "—"}</td>
                    <td className="tableCell font14 blackText">{c.phone || "—"}</td>
                    <td className="tableCell font14 blackText">{c.company || "—"}</td>
                    <td className="tableCell font14 blackText">{c.productName || "—"}</td>
                    <td className="tableCell font14 blackText">{c.quantity != null ? c.quantity : "—"}</td>
                    <td className="tableCell font14 blackText">{c.status || "—"}</td>
                    <td className="tableCell font14 blackText">
                      {c.assignedTo ? (c.assignedTo.name || c.assignedTo.email || "—") : "—"}
                    </td>
                    <td className="tableCell font14 blackText">
                      {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadsDownload;
