import React, { useState, useEffect, useMemo, useRef } from "react";
import api from '../api/axios';
import { 
  PageHeader, 
  AlertMessage, 
  ViewToggle, 
  Pagination, 
  FormField, 
  ActionButtons,
  SearchField,
  StatusFilter,
  EntityCard,
  DeleteConfirmationPopup,
} from '../common';
import { usePermissions } from '../context/PermissionContext';

/**
 * Client Management System
 * 
 * Comprehensive CRM functionality including:
 * - Client CRUD operations
 * - Status pipeline management (Lead → Active → Closed)
 * - Interaction tracking (calls, emails, meetings, notes)
 * - Follow-up scheduling
 * - Search and filtering
 * - Dashboard statistics
 */

// Status options for pipeline
const STATUS_OPTIONS = [
  { value: "lead", label: "Lead", color: "#6c757d" },
  { value: "prospect", label: "Prospect", color: "#17a2b8" },
  { value: "active", label: "Active", color: "#28a745" },
  { value: "inactive", label: "Inactive", color: "#ffc107" },
  { value: "closed", label: "Closed", color: "#007bff" },
  { value: "lost", label: "Lost", color: "#dc3545" },
];

const STATUS_DESCRIPTIONS = {
  lead: "New contact or enquiry. Not yet qualified or in active sales process.",
  prospect: "Qualified lead showing interest. Following up for conversion.",
  active: "Current customer or deal in progress. Active relationship.",
  inactive: "No recent activity. May need re-engagement or follow-up.",
  closed: "Deal won or relationship concluded successfully.",
  lost: "Opportunity lost or contact no longer pursuing.",
};

/** Pipeline shortcuts after entity pills (lead = "Active Leads" on entity row) */
const PIPELINE_QUICK_FILTER_KEYS = ["prospect", "closed", "lost"];

// Priority options
const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", color: "#6c757d" },
  { value: "medium", label: "Medium", color: "#17a2b8" },
  { value: "high", label: "High", color: "#ffc107" },
  { value: "urgent", label: "Urgent", color: "#dc3545" },
];

// Source options
const SOURCE_OPTIONS = [
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "social_media", label: "Social Media" },
  { value: "cold_call", label: "Cold Call" },
  { value: "email_campaign", label: "Email Campaign" },
  { value: "trade_show", label: "Trade Show" },
  { value: "advertisement", label: "Advertisement" },
  { value: "partner", label: "Partner" },
  { value: "other", label: "Other" },
];

// Interaction types
function getClientWebsiteLabel(client, websiteList = []) {
  if (!client?.website) return ""
  const w = client.website
  if (typeof w === "object" && w !== null && !Array.isArray(w)) {
    const label = (w.name || w.domain || "").trim()
    if (label) return label
    const oid = w._id != null ? String(w._id) : ""
    if (oid && websiteList.length) {
      const found = websiteList.find((sw) => String(sw._id) === oid)
      if (found) return (found.name || found.domain || "").trim() || ""
    }
    return ""
  }
  const idStr = typeof w === "string" ? w : ""
  if (idStr && websiteList.length) {
    const found = websiteList.find((sw) => String(sw._id) === idStr)
    if (found) return (found.name || found.domain || "").trim() || ""
  }
  return ""
}

function truncateNotes(text, maxLen = 220) {
  if (!text || typeof text !== "string") return ""
  const t = text.trim()
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen)}…`
}

const WEBSITE_NAME_DISPLAY_MAX = 20

function truncateWebsiteName(label, maxLen = WEBSITE_NAME_DISPLAY_MAX) {
  if (!label || typeof label !== "string") return ""
  const t = label.trim()
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen)}...`
}

/**
 * Lead list entity tabs: "Active Leads" = pipeline `lead`; Inactive = pipeline `inactive`.
 * Deleted uses the soft-delete flag.
 */
function filterLeadListByEntityTab(entities, statusFilter) {
  if (statusFilter === "all") return entities
  if (statusFilter === "deleted") return entities.filter((e) => e.deleted)
  if (statusFilter === "lead") return entities.filter((e) => e.status === "lead" && !e.deleted)
  if (statusFilter === "inactive") return entities.filter((e) => e.status === "inactive" && !e.deleted)
  return entities
}

/** Same rules as the visible list; used for tab counts and filteredClients. */
function applyClientFilters(clients, websiteList, { statusFilter, pipelineFilter, priorityFilter, searchQuery }) {
  let filtered = clients
  filtered = filterLeadListByEntityTab(filtered, statusFilter)
  if (pipelineFilter !== "all") {
    filtered = filtered.filter((c) => c.status === pipelineFilter)
  }
  if (priorityFilter !== "all") {
    filtered = filtered.filter((c) => c.priority === priorityFilter)
  }
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim()
    filtered = filtered.filter(
      (client) =>
        client.firstName?.toLowerCase().includes(query) ||
        client.lastName?.toLowerCase().includes(query) ||
        client.email?.toLowerCase().includes(query) ||
        client.phone?.includes(query) ||
        client.company?.toLowerCase().includes(query) ||
        client.clientId?.toLowerCase().includes(query) ||
        client.productName?.toLowerCase().includes(query) ||
        client.location?.toLowerCase().includes(query) ||
        client.notes?.toLowerCase().includes(query) ||
        getClientWebsiteLabel(client, websiteList)?.toLowerCase().includes(query)
    )
  }
  return filtered
}

const INTERACTION_TYPES = [
  { value: "call_outbound", label: "📞 Outbound Call" },
  { value: "call_inbound", label: "📲 Inbound Call" },
  { value: "email_sent", label: "📧 Email Sent" },
  { value: "email_received", label: "📨 Email Received" },
  { value: "meeting", label: "🤝 Meeting" },
  { value: "video_call", label: "📹 Video Call" },
  { value: "follow_up", label: "📅 Follow-up" },
  { value: "note", label: "📝 Note" },
  { value: "task", label: "✅ Task" },
];

const ClientManager = () => {
  const { isSuperAdmin } = usePermissions();
  // State for clients
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [stats, setStats] = useState(null);
  const [websites, setWebsites] = useState([]);

  // View and filter states
  const [viewMode, setViewMode] = useState('card');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pipelineFilter, setPipelineFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter] = useState("all");
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);
  const [hasMoreCards, setHasMoreCards] = useState(true);
  const [displayedCards, setDisplayedCards] = useState([]);
  
  // Form state
  const initialFormData = {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    alternatePhone: "",
    company: "",
    designation: "",
    industry: "",
    address: {
      street: "",
      city: "",
      state: "",
      postalCode: "",
      country: "India",
    },
    status: "lead",
    source: "other",
    sourceDetails: "",
    tags: "",
    priority: "medium",
    estimatedValue: "",
    currency: "INR",
    nextFollowUp: "",
    notes: "",
    internalNotes: "",
    socialProfiles: {
      linkedin: "",
      twitter: "",
      website: "",
    },
    isActive: true,
  };
  
  const [formData, setFormData] = useState(initialFormData);
  
  // Interaction modal state
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [interactionForm, setInteractionForm] = useState({
    type: "note",
    subject: "",
    description: "",
    outcome: "pending",
    duration: "",
    scheduledAt: "",
    priority: "medium",
    followUpRequired: false,
    nextFollowUpDate: "",
  });
  
  // Delete confirmation
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    clientId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete",
  });
  
  // Refs
  const formRef = useRef(null);
  const nameInputRef = useRef(null);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await api.get('/clients', {
        params: {
          showInactive: 'true',
          includeDeleted: 'true',
          limit: 100,
        },
      });
      
      setClients(response.data.clients || []);
      setError("");
    } catch (err) {
      console.error("Error fetching clients:", err);
      setError("Failed to load clients. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/clients/stats');
      setStats(response.data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const fetchClientInteractions = async (clientId) => {
    try {
      const response = await api.get(`/interactions/client/${clientId}`);
      setInteractions(response.data.interactions || []);
    } catch (err) {
      console.error("Error fetching interactions:", err);
    }
  };

  useEffect(() => {
    fetchClients();
    fetchStats();
  }, []);

  useEffect(() => {
    if (isSuperAdmin && websites.length === 0) {
      api
        .get('/websites?showInactive=true&includeDeleted=false', { skipWebsiteId: true })
        .then((res) => {
          setWebsites(Array.isArray(res.data) ? res.data : []);
        })
        .catch(() => setWebsites([]));
    }
  }, [isSuperAdmin, websites.length]);

  // ============================================================================
  // FILTERING AND PAGINATION
  // ============================================================================

  const filteredClients = useMemo(() => {
    const filtered = applyClientFilters(clients, websites, {
      statusFilter,
      pipelineFilter,
      priorityFilter,
      searchQuery,
    })
    return [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [clients, searchQuery, statusFilter, pipelineFilter, priorityFilter, websites])

  /**
   * Entity tab counts: respect priority + search only.
   * Do not apply pipelineFilter here — otherwise choosing Prospect/Lost zeros Active Leads / Inactive / Deleted pills.
   */
  const entityTabCounts = useMemo(() => {
    const base = applyClientFilters(clients, websites, {
      statusFilter: "all",
      pipelineFilter: "all",
      priorityFilter,
      searchQuery,
    })
    return {
      total: base.length,
      lead: base.filter((c) => c.status === "lead" && !c.deleted).length,
      inactive: base.filter((c) => c.status === "inactive" && !c.deleted).length,
      deleted: base.filter((c) => c.deleted).length,
    }
  }, [clients, websites, priorityFilter, searchQuery])

  /**
   * Pipeline shortcut counts (Prospect / Closed / Lost): respect priority + search only.
   * Do not apply statusFilter here — otherwise Active Leads tab makes Prospect/Lost pills all 0.
   */
  const pipelineTabCounts = useMemo(() => {
    const base = applyClientFilters(clients, websites, {
      statusFilter: "all",
      pipelineFilter: "all",
      priorityFilter,
      searchQuery,
    })
    const counts = {}
    PIPELINE_QUICK_FILTER_KEYS.forEach((key) => {
      counts[key] = base.filter((c) => c.status === key).length
    })
    return counts
  }, [clients, websites, priorityFilter, searchQuery])

  const entityStatusFilterOptions = useMemo(
    () => [
      { key: "all", label: "All Stages", count: entityTabCounts.total, color: "black" },
      { key: "lead", label: "Active Leads", count: entityTabCounts.lead, color: "green" },
      { key: "inactive", label: "Inactive", count: entityTabCounts.inactive, color: "gray" },
      { key: "deleted", label: "Deleted", count: entityTabCounts.deleted, color: "red" },
    ],
    [entityTabCounts],
  )

  // Pagination
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentClients = filteredClients.slice(startIndex, endIndex);

  // Card lazy loading
  useEffect(() => {
    if (viewMode === 'card' && filteredClients.length > 0) {
      const initialCards = filteredClients.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredClients.length > 12);
      setCurrentPage(1);
    }
  }, [filteredClients, viewMode]);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoadMoreCards = () => {
    const currentCardCount = displayedCards.length;
    const nextCards = filteredClients.slice(currentCardCount, currentCardCount + 12);
    
    if (nextCards.length > 0) {
      setDisplayedCards([...displayedCards, ...nextCards]);
      setHasMoreCards(currentCardCount + nextCards.length < filteredClients.length);
    } else {
      setHasMoreCards(false);
    }
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    setCurrentPage(1);
    if (mode === 'card') {
      const initialCards = filteredClients.slice(0, 12);
      setDisplayedCards(initialCards);
      setHasMoreCards(filteredClients.length > 12);
    }
  };

  // ============================================================================
  // FORM HANDLING
  // ============================================================================

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith("address.")) {
      const addressKey = name.replace("address.", "");
      setFormData(prev => ({
        ...prev,
        address: { ...prev.address, [addressKey]: value },
      }));
    } else if (name.startsWith("socialProfiles.")) {
      const profileKey = name.replace("socialProfiles.", "");
      setFormData(prev => ({
        ...prev,
        socialProfiles: { ...prev.socialProfiles, [profileKey]: value },
      }));
    } else if (type === "checkbox") {
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingId(null);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.firstName.trim()) {
      setError("First name is required");
      return;
    }
    
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      
      const submitData = {
        ...formData,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName?.trim() || "",
        email: formData.email?.trim().toLowerCase() || "",
        phone: formData.phone?.trim() || "",
        company: formData.company?.trim() || "",
        estimatedValue: parseFloat(formData.estimatedValue) || 0,
        nextFollowUp: formData.nextFollowUp || null,
      };
      
      if (editingId) {
        await api.put(`/clients/${editingId}`, submitData);
        setSuccess(`Client "${formData.firstName} ${formData.lastName}" updated successfully!`);
      } else {
        await api.post('/clients', submitData);
        setSuccess(`Client "${formData.firstName} ${formData.lastName}" created successfully!`);
      }
      
      await fetchClients();
      await fetchStats();
      resetForm();
    } catch (err) {
      const action = editingId ? "update" : "create";
      setError(`Failed to ${action} client. ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (client) => {
    setFormData({
      firstName: client.firstName || "",
      lastName: client.lastName || "",
      email: client.email || "",
      phone: client.phone || "",
      alternatePhone: client.alternatePhone || "",
      company: client.company || "",
      designation: client.designation || "",
      industry: client.industry || "",
      address: {
        street: client.address?.street || "",
        city: client.address?.city || "",
        state: client.address?.state || "",
        postalCode: client.address?.postalCode || "",
        country: client.address?.country || "India",
      },
      status: client.status || "lead",
      source: client.source || "other",
      sourceDetails: client.sourceDetails || "",
      tags: Array.isArray(client.tags) ? client.tags.join(", ") : "",
      priority: client.priority || "medium",
      estimatedValue: client.estimatedValue || "",
      currency: client.currency || "INR",
      nextFollowUp: client.nextFollowUp ? client.nextFollowUp.split('T')[0] : "",
      notes: client.notes || "",
      internalNotes: client.internalNotes || "",
      socialProfiles: {
        linkedin: client.socialProfiles?.linkedin || "",
        twitter: client.socialProfiles?.twitter || "",
        website: client.socialProfiles?.website || "",
      },
      isActive: client.isActive !== false,
    });
    
    setEditingId(client._id);
    setError("");
    setSuccess("");
    
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      nameInputRef.current?.focus();
    }, 100);
  };

  const handleCancel = () => {
    resetForm();
  };

  // ============================================================================
  // DELETE HANDLING
  // ============================================================================

  const handleDelete = (clientId) => {
    const client = clients.find(c => c._id === clientId);
    const isAlreadyDeleted = client?.deleted;
    
    setDeletePopup({
      isVisible: true,
      clientId,
      message: isAlreadyDeleted
        ? `Permanently delete "${client.firstName} ${client.lastName}"? This cannot be undone.`
        : `Delete "${client.firstName} ${client.lastName}"? They can be restored later.`,
      isPermanentDelete: isAlreadyDeleted,
      action: "delete",
    });
  };

  const handleDeleteConfirm = async () => {
    const { clientId, isPermanentDelete } = deletePopup;
    const client = clients.find(c => c._id === clientId);
    
    try {
      setLoading(true);
      
      if (isPermanentDelete) {
        await api.delete(`/clients/${clientId}/hard`);
        setSuccess(`Client "${client.firstName}" permanently deleted.`);
      } else {
        await api.delete(`/clients/${clientId}`);
        setSuccess(`Client "${client.firstName}" deleted.`);
      }
      
      await fetchClients();
      await fetchStats();
    } catch (err) {
      setError(`Failed to delete client. ${err.response?.data?.msg || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setDeletePopup({ isVisible: false, clientId: null, message: "", isPermanentDelete: false, action: "delete" });
    }
  };

  const handleRestore = async (clientId) => {
    const client = clients.find(c => c._id === clientId);
    
    try {
      setLoading(true);
      await api.post(`/clients/${clientId}/restore`);
      setSuccess(`Client "${client.firstName}" restored!`);
      await fetchClients();
      await fetchStats();
    } catch (err) {
      setError(`Failed to restore client. ${err.response?.data?.msg || ''}`);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // STATUS UPDATE
  // ============================================================================

  const handleStatusChange = async (clientId, newStatus) => {
    try {
      await api.put(`/clients/${clientId}/status`, { status: newStatus });
      await fetchClients();
      await fetchStats();
      setSuccess("Status updated!");
    } catch (err) {
      setError("Failed to update status.");
    }
  };

  // ============================================================================
  // INTERACTIONS
  // ============================================================================

  const openInteractionModal = async (client) => {
    setSelectedClient(client);
    setShowInteractionModal(true);
    await fetchClientInteractions(client._id);
  };

  const closeInteractionModal = () => {
    setShowInteractionModal(false);
    setSelectedClient(null);
    setInteractions([]);
    setInteractionForm({
      type: "note",
      subject: "",
      description: "",
      outcome: "pending",
      duration: "",
      scheduledAt: "",
      priority: "medium",
      followUpRequired: false,
      nextFollowUpDate: "",
    });
  };

  const handleInteractionFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setInteractionForm(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleAddInteraction = async (e) => {
    e.preventDefault();
    
    if (!interactionForm.subject.trim() && interactionForm.type !== "note") {
      setError("Subject is required");
      return;
    }
    
    try {
      setLoading(true);
      
      await api.post('/interactions', {
        client: selectedClient._id,
        ...interactionForm,
        subject: interactionForm.subject.trim() || (interactionForm.type === "note" ? "Note" : ""),
      });
      
      await fetchClientInteractions(selectedClient._id);
      await fetchClients();
      await fetchStats();
      
      // Reset form
      setInteractionForm({
        type: "note",
        subject: "",
        description: "",
        outcome: "pending",
        duration: "",
        scheduledAt: "",
        priority: "medium",
        followUpRequired: false,
        nextFollowUpDate: "",
      });
      
      setSuccess("Interaction logged!");
    } catch (err) {
      setError("Failed to log interaction.");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  const getStatusColor = (status) => {
    const option = STATUS_OPTIONS.find(s => s.value === status);
    return option?.color || "#6c757d";
  };

  const getPriorityColor = (priority) => {
    const option = PRIORITY_OPTIONS.find(p => p.value === priority);
    return option?.color || "#6c757d";
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString();
  };

  const formatDateTime = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleString();
  };

  const getClientName = (client) => {
    return `${client.firstName} ${client.lastName || ""}`.trim();
  };

  const getInitials = (client) => {
    const first = client.firstName?.[0] || "";
    const last = client.lastName?.[0] || "";
    return (first + last).toUpperCase() || "?";
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="paddingAll20">
      {/* Header */}
      <PageHeader
        title="Client Management"
        subtitle="Manage your clients, track interactions, and follow-ups"
        isEditing={!!editingId}
        editText="Edit Client"
        createText="Add New Client"
      />

      {/* Success/Error Messages */}
      <AlertMessage type="success" message={success} onClose={() => setSuccess("")} autoClose={true} />
      <AlertMessage type="error" message={error} onClose={() => setError("")} autoClose={true} />

      {/* Statistics Cards */}
      {stats && (
        <div className="statsContainer makeFlex gap16 appendBottom24" style={{ flexWrap: 'wrap' }}>
          <div className="statCard" style={{ flex: '1', minWidth: '140px', padding: '16px', backgroundColor: '#e3f2fd', borderRadius: '8px' }}>
            <div className="font24 fontBold" style={{ color: '#1976d2' }}>{stats.total || 0}</div>
            <div className="font14 grayText">Total Clients</div>
          </div>
          <div className="statCard" style={{ flex: '1', minWidth: '140px', padding: '16px', backgroundColor: '#e8f5e9', borderRadius: '8px' }}>
            <div className="font24 fontBold" style={{ color: '#388e3c' }}>{stats.byStatus?.active || 0}</div>
            <div className="font14 grayText">Active</div>
          </div>
          <div className="statCard" style={{ flex: '1', minWidth: '140px', padding: '16px', backgroundColor: '#fff3e0', borderRadius: '8px' }}>
            <div className="font24 fontBold" style={{ color: '#f57c00' }}>{stats.byStatus?.lead || 0}</div>
            <div className="font14 grayText">Leads</div>
          </div>
          <div className="statCard" style={{ flex: '1', minWidth: '140px', padding: '16px', backgroundColor: '#fce4ec', borderRadius: '8px' }}>
            <div className="font24 fontBold" style={{ color: '#c2185b' }}>{stats.upcomingFollowUps || 0}</div>
            <div className="font14 grayText">Follow-ups Due</div>
          </div>
          <div className="statCard" style={{ flex: '1', minWidth: '140px', padding: '16px', backgroundColor: '#f3e5f5', borderRadius: '8px' }}>
            <div className="font24 fontBold" style={{ color: '#7b1fa2' }}>{stats.thisWeek || 0}</div>
            <div className="font14 grayText">Added This Week</div>
          </div>
        </div>
      )}

      {/* Client Form */}
      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        <form onSubmit={handleSubmit} className="brandForm">
          {/* Basic Info */}
          <h4 className="font16 fontSemiBold appendBottom12">Basic Information</h4>
          <div className="makeFlex row gap16">
            <div className="flexOne">
              <FormField
                ref={nameInputRef}
                type="text"
                name="firstName"
                label="First Name"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Enter first name"
                required={true}
              />
            </div>
            <div className="flexOne">
              <FormField
                type="text"
                name="lastName"
                label="Last Name"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Enter last name"
              />
            </div>
          </div>

          <div className="makeFlex row gap16">
            <div className="flexOne">
              <FormField
                type="email"
                name="email"
                label="Email"
                value={formData.email}
                onChange={handleChange}
                placeholder="client@example.com"
              />
            </div>
            <div className="flexOne">
              <FormField
                type="text"
                name="phone"
                label="Phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <div className="makeFlex row gap16">
            <div className="flexOne">
              <FormField
                type="text"
                name="company"
                label="Company"
                value={formData.company}
                onChange={handleChange}
                placeholder="Company name"
              />
            </div>
            <div className="flexOne">
              <FormField
                type="text"
                name="designation"
                label="Designation"
                value={formData.designation}
                onChange={handleChange}
                placeholder="Job title"
              />
            </div>
          </div>

          {/* Status and Source */}
          <h4 className="font16 fontSemiBold appendTop16 appendBottom12">Status & Source</h4>
          <div className="makeFlex row gap16">
            <div className="flexOne">
              <FormField
                type="select"
                name="status"
                label="Pipeline Status"
                value={formData.status}
                onChange={handleChange}
                options={STATUS_OPTIONS}
              />
              {formData.status && STATUS_DESCRIPTIONS[formData.status] && (
                <p className="font12 grayText appendTop6" style={{ margin: 0, lineHeight: 1.4 }}>
                  {STATUS_DESCRIPTIONS[formData.status]}
                </p>
              )}
            </div>
            <div className="flexOne">
              <FormField
                type="select"
                name="priority"
                label="Priority"
                value={formData.priority}
                onChange={handleChange}
                options={PRIORITY_OPTIONS}
              />
            </div>
            <div className="flexOne">
              <FormField
                type="select"
                name="source"
                label="Lead Source"
                value={formData.source}
                onChange={handleChange}
                options={SOURCE_OPTIONS}
              />
            </div>
          </div>

          <div className="makeFlex row gap16">
            <div className="flexOne">
              <FormField
                type="text"
                name="tags"
                label="Tags (comma separated)"
                value={formData.tags}
                onChange={handleChange}
                placeholder="vip, enterprise, retail"
              />
            </div>
            <div className="flexOne">
              <FormField
                type="number"
                name="estimatedValue"
                label="Estimated Value (₹)"
                value={formData.estimatedValue}
                onChange={handleChange}
                placeholder="50000"
                min={0}
              />
            </div>
            <div className="flexOne">
              <FormField
                type="date"
                name="nextFollowUp"
                label="Next Follow-up"
                value={formData.nextFollowUp}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Notes */}
          <h4 className="font16 fontSemiBold appendTop16 appendBottom12">Notes</h4>
          <div className="makeFlex row gap16">
            <div className="fullWidth">
              <FormField
                type="textarea"
                name="notes"
                label="Notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="General notes about this client..."
                rows={3}
              />
            </div>
          </div>

          {/* Active Checkbox */}
          <div className="makeFlex alignCenter gap8 appendTop16">
            <FormField
              type="checkbox"
              name="isActive"
              value={formData.isActive}
              onChange={handleChange}
            />
            <label>Active</label>
          </div>

          {/* Form Actions */}
          <div className="formActions paddingTop16">
            <button type="submit" disabled={loading} className="btnPrimary">
              {loading ? "Saving..." : (editingId ? "Update Client" : "Add Client")}
            </button>
            {editingId && (
              <button type="button" onClick={handleCancel} className="btnSecondary">
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Clients List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">
              Clients ({filteredClients.length})
            </h2>
            <StatusFilter
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              statusOptions={entityStatusFilterOptions}
              disabled={loading}
              suffix={(
                <>
                  {PIPELINE_QUICK_FILTER_KEYS.map((value) => {
                    const status = STATUS_OPTIONS.find((s) => s.value === value)
                    if (!status) return null
                    const active = pipelineFilter === value
                    const c = status.color
                    return (
                      <button
                        key={value}
                        type="button"
                        className="statusFilterBtn"
                        onClick={() => setPipelineFilter(value)}
                        disabled={loading}
                        title={`Filter by ${status.label} pipeline status`}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "4px",
                          border: `1px solid ${c}`,
                          background: active ? c : "#fff",
                          color: active ? "#fff" : c,
                          cursor: loading ? "not-allowed" : "pointer",
                          fontSize: "12px",
                          transition: "all 0.2s ease",
                          opacity: loading ? 0.6 : 1,
                        }}
                      >
                        {status.label} ({pipelineTabCounts[value] ?? 0})
                      </button>
                    )
                  })}
                </>
              )}
            />
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clients..."
              disabled={loading}
              minWidth="250px"
            />
            {loading && <div className="loadingIndicator grayText">Loading...</div>}
            <ViewToggle viewMode={viewMode} onViewChange={handleViewModeChange} disabled={loading} />
          </div>
        </div>

        {filteredClients.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">👤</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Clients Found</h3>
            <p className="font16 grayText">Add your first client above to get started</p>
          </div>
        ) : (
          <>
            {/* Card View */}
            {viewMode === 'card' && (
              <div className="brandsGrid">
                {displayedCards.map((client) => {
                  const websiteLabel = getClientWebsiteLabel(client, websites)
                  const websiteLabelDisplay = truncateWebsiteName(websiteLabel)
                  return (
                  <EntityCard
                    key={client._id}
                    entity={client}
                    showImage={false}
                    showId={false}
                    size="normal"
                    variant="detailed"
                    className="brandCard"
                    renderHeader={(client) => (
                      <div
                        className="entityCardHeader appendBottom16"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <div className="makeFlex" style={{ minWidth: 0, flex: 1, alignItems: "flex-start" }}>
                          <div style={{ paddingRight: "10px", flexShrink: 0, alignSelf: "flex-start" }}>
                            <div
                              style={{
                                width: "48px",
                                height: "48px",
                                borderRadius: "50%",
                                backgroundColor: getStatusColor(client.status),
                                color: "#fff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: "bold",
                                fontSize: "16px",
                              }}
                            >
                              {getInitials(client)}
                            </div>
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="font16 fontBold">{getClientName(client)}</div>
                            <div className="font12 grayText">{client.company || "No company"}</div>
                            {websiteLabel && (
                              <div className="appendTop4" style={{ marginTop: "4px" }}>
                                <span
                                  title={websiteLabel}
                                  style={{
                                    display: "inline-block",
                                    maxWidth: "100%",
                                    verticalAlign: "top",
                                    padding: "3px 10px",
                                    borderRadius: "6px",
                                    backgroundColor: "#e8f4ff",
                                    color: "#0d47a1",
                                    fontSize: "11px",
                                    fontWeight: 600,
                                    border: "1px solid #b8d4f0",
                                  }}
                                >
                                  {websiteLabelDisplay}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            backgroundColor: getPriorityColor(client.priority),
                            color: '#fff',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            flexShrink: 0,
                            marginLeft: '8px',
                          }}
                        >
                          {client.priority}
                        </span>
                      </div>
                    )}
                    renderDetails={(client) => (
                      <>
                        {client.email && (
                          <div
                            className="makeFlex alignCenter appendBottom8"
                            style={{ gap: "10px" }}
                          >
                            <span style={{ flexShrink: 0 }}>📧</span>
                            <span className="font14" style={{ wordBreak: 'break-all', minWidth: 0 }}>{client.email}</span>
                          </div>
                        )}
                        {client.phone && (
                          <div
                            className="makeFlex alignCenter appendBottom8"
                            style={{ gap: "10px" }}
                          >
                            <span style={{ flexShrink: 0 }}>📞</span>
                            <span className="font14" style={{ minWidth: 0 }}>{client.phone}</span>
                          </div>
                        )}
                        {(client.notes || (isSuperAdmin && client.internalNotes)) && (
                          <div className="appendTop8 appendBottom8" style={{ paddingTop: "8px", borderTop: "1px solid #eee" }}>
                            {client.notes && (
                              <div className="font12" style={{ lineHeight: 1.45, color: "#333" }}>
                                <span className="grayText">Notes: </span>
                                {truncateNotes(client.notes)}
                              </div>
                            )}
                            {isSuperAdmin && client.internalNotes && (
                              <div className="font12 appendTop6" style={{ lineHeight: 1.45, color: "#555" }}>
                                <span className="grayText">Internal notes: </span>
                                {truncateNotes(client.internalNotes)}
                              </div>
                            )}
                          </div>
                        )}
                        {(client.productName || client.quantity != null || client.location) && (
                          <div className="appendTop8 appendBottom8" style={{ paddingTop: '8px', borderTop: '1px solid #eee' }}>
                            {client.productName && <div className="font12"><span className="grayText">Product: </span>{client.productName}</div>}
                            {client.quantity != null && client.quantity !== "" && <div className="font12"><span className="grayText">Qty: </span>{client.quantity}</div>}
                            {client.location && <div className="font12"><span className="grayText">Location: </span>{client.location}</div>}
                          </div>
                        )}
                        {(client.assignedTo && (client.assignedTo.name || client.assignedTo.email)) && (
                          <div className="makeFlex alignCenter gap8 appendTop8">
                            <span className="font12 grayText">Assigned to:</span>
                            <span className="font12">{client.assignedTo.name || client.assignedTo.email}</span>
                          </div>
                        )}
                        <div className="makeFlex spaceBetween appendTop8">
                          <span className="font12 grayText">Status:</span>
                          <select
                            value={client.status}
                            onChange={(e) => handleStatusChange(client._id, e.target.value)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: '1px solid #e0e0e0',
                              backgroundColor: getStatusColor(client.status),
                              color: '#fff',
                              fontSize: '12px',
                              cursor: 'pointer',
                              flexBasis: 'content',
                            }}
                            disabled={client.deleted}
                          >
                            {STATUS_OPTIONS.map(s => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </div>
                        {client.nextFollowUp && (
                        <div className="makeFlex spaceBetween appendTop8">
                          <span className="font12 grayText">Follow-up:</span>
                          <span className="font12" style={{ color: new Date(client.nextFollowUp) < new Date() ? '#dc3545' : '#28a745' }}>
                            {formatDate(client.nextFollowUp)}
                          </span>
                        </div>
                      )}
                      <div className="makeFlex spaceBetween appendTop8">
                        <span className="font12 grayText">Interactions:</span>
                        <span className="font12">{client.interactionCount || 0}</span>
                      </div>
                    </>
                  )}
                  renderActions={(client) => (
                    <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0', backgroundColor: '#fafafa' }}>
                      <div className="makeFlex gap8 flexWrap">
                        {!client.deleted && (
                          <>
                            <button
                              className="btnSmall btnSecondary"
                              onClick={() => handleEdit(client)}
                              disabled={loading}
                              style={{ fontSize: '12px', padding: '6px 10px' }}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="btnSmall btnSecondary"
                              onClick={() => openInteractionModal(client)}
                              disabled={loading}
                              style={{
                                fontSize: '12px',
                                padding: '6px 10px',
                                backgroundColor: '#17a2b8',
                                color: '#fff',
                                border: 'none',
                              }}
                            >
                              💬 Log
                            </button>
                          </>
                        )}
                        <button
                          className="btnSmall btnDanger"
                          onClick={() => handleDelete(client._id)}
                          disabled={loading}
                          style={{ fontSize: '12px', padding: '6px 10px' }}
                        >
                          🗑️ Delete
                        </button>
                        {client.deleted && (
                          <button
                            className="btnSmall"
                            onClick={() => handleRestore(client._id)}
                            disabled={loading}
                            style={{ fontSize: '12px', padding: '6px 10px', backgroundColor: '#17a2b8', color: '#fff', border: 'none' }}
                          >
                            🔄 Restore
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                />
                  );
                })}
              </div>
            )}

            {/* Load More for Card View */}
            {viewMode === 'card' && hasMoreCards && (
              <div className="loadMoreContainer textCenter paddingAll20">
                <button onClick={handleLoadMoreCards} className="btnPrimary" disabled={loading}>
                  {loading ? "Loading..." : "Load More"}
                </button>
              </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="brandsListTable">
                <div className="tableContainer" style={{ overflowX: 'auto' }}>
                  <table className="brandsTable" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f5f5f5' }}>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Client</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Contact</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Company</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Website</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Product</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Qty</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Location</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Priority</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Follow-up</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentClients.map((client) => {
                        const websiteLabel = getClientWebsiteLabel(client, websites)
                        const websiteLabelDisplay = truncateWebsiteName(websiteLabel)
                        return (
                        <tr key={client._id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                          <td style={{ padding: '12px' }}>
                            <div className="makeFlex alignCenter gap8">
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  backgroundColor: getStatusColor(client.status),
                                  color: '#fff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                }}
                              >
                                {getInitials(client)}
                              </div>
                              <div>
                                <div className="font14 fontSemiBold">{getClientName(client)}</div>
                                <div className="font12 grayText">{client.clientId}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div className="font14">{client.email || "-"}</div>
                            <div className="font12 grayText">{client.phone || "-"}</div>
                          </td>
                          <td style={{ padding: '12px' }}>{client.company || "-"}</td>
                          <td style={{ padding: '12px' }}>
                            {websiteLabel ? (
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "2px 8px",
                                  borderRadius: "6px",
                                  backgroundColor: "#e8f4ff",
                                  color: "#0d47a1",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                }}
                                title={websiteLabel}
                              >
                                {websiteLabelDisplay}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td style={{ padding: '12px' }}>{client.productName || "-"}</td>
                          <td style={{ padding: '12px' }}>{client.quantity != null && client.quantity !== "" ? client.quantity : "-"}</td>
                          <td style={{ padding: '12px' }}>{client.location || "-"}</td>
                          <td style={{ padding: '12px' }}>
                            <span
                              style={{
                                padding: '4px 8px',
                                borderRadius: '12px',
                                backgroundColor: getStatusColor(client.status),
                                color: '#fff',
                                fontSize: '12px',
                              }}
                            >
                              {STATUS_OPTIONS.find(s => s.value === client.status)?.label || client.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span
                              style={{
                                padding: '4px 8px',
                                borderRadius: '12px',
                                backgroundColor: getPriorityColor(client.priority),
                                color: '#fff',
                                fontSize: '12px',
                              }}
                            >
                              {client.priority}
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            {client.nextFollowUp ? (
                              <span style={{ color: new Date(client.nextFollowUp) < new Date() ? '#dc3545' : '#28a745' }}>
                                {formatDate(client.nextFollowUp)}
                              </span>
                            ) : "-"}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <ActionButtons
                              onEdit={client.deleted ? undefined : () => handleEdit(client)}
                              onDelete={() => handleDelete(client._id)}
                              onRevert={client.deleted ? () => handleRestore(client._id) : undefined}
                              loading={loading}
                              size="small"
                              editText="✏️"
                              deleteText="🗑️ Delete"
                              revertText="🔄"
                              editDisabled={client.deleted}
                            />
                          </td>
                        </tr>
                        );
                      })}
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
          </>
        )}
      </div>

      {/* Interaction Modal */}
      {showInteractionModal && selectedClient && (
        <div
          className="modalOverlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={closeInteractionModal}
        >
          <div
            className="modalContent"
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '800px',
              maxHeight: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: '20px', borderBottom: '1px solid #e0e0e0' }}>
              <div className="makeFlex spaceBetween alignCenter">
                <div>
                  <h3 className="font20 fontBold">Interactions: {getClientName(selectedClient)}</h3>
                  <p className="font14 grayText">{selectedClient.company} | {selectedClient.email}</p>
                </div>
                <button
                  onClick={closeInteractionModal}
                  style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
              {/* Quick Add Form */}
              <div style={{ backgroundColor: '#f9f9f9', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                <h4 className="font16 fontSemiBold appendBottom12">Log New Interaction</h4>
                <form onSubmit={handleAddInteraction}>
                  <div className="makeFlex row gap16 appendBottom12">
                    <div className="flexOne">
                      <label className="font12 fontSemiBold grayText">Type</label>
                      <select
                        name="type"
                        value={interactionForm.type}
                        onChange={handleInteractionFormChange}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e0e0e0' }}
                      >
                        {INTERACTION_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flexOne">
                      <label className="font12 fontSemiBold grayText">Subject</label>
                      <input
                        type="text"
                        name="subject"
                        value={interactionForm.subject}
                        onChange={handleInteractionFormChange}
                        placeholder="Brief subject..."
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e0e0e0' }}
                      />
                    </div>
                  </div>
                  <div className="appendBottom12">
                    <label className="font12 fontSemiBold grayText">Notes</label>
                    <textarea
                      name="description"
                      value={interactionForm.description}
                      onChange={handleInteractionFormChange}
                      placeholder="Details about this interaction..."
                      rows={3}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e0e0e0', resize: 'vertical' }}
                    />
                  </div>
                  <div className="makeFlex row gap16 appendBottom12">
                    <div className="flexOne">
                      <label className="font12 fontSemiBold grayText">Scheduled For</label>
                      <input
                        type="datetime-local"
                        name="scheduledAt"
                        value={interactionForm.scheduledAt}
                        onChange={handleInteractionFormChange}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e0e0e0' }}
                      />
                    </div>
                    <div className="flexOne makeFlex alignCenter gap8" style={{ paddingTop: '20px' }}>
                      <input
                        type="checkbox"
                        name="followUpRequired"
                        checked={interactionForm.followUpRequired}
                        onChange={handleInteractionFormChange}
                      />
                      <label className="font14">Follow-up Required</label>
                    </div>
                  </div>
                  <button type="submit" className="btnPrimary" disabled={loading}>
                    {loading ? "Saving..." : "Add Interaction"}
                  </button>
                </form>
              </div>

              {/* Interactions History */}
              <h4 className="font16 fontSemiBold appendBottom12">Activity History ({interactions.length})</h4>
              {interactions.length === 0 ? (
                <div className="textCenter paddingAll20 grayText">No interactions logged yet</div>
              ) : (
                <div className="interactionsList">
                  {interactions.map((interaction) => (
                    <div
                      key={interaction._id}
                      style={{
                        padding: '12px',
                        borderLeft: `3px solid ${getStatusColor(selectedClient.status)}`,
                        backgroundColor: '#f9f9f9',
                        marginBottom: '8px',
                        borderRadius: '0 8px 8px 0',
                      }}
                    >
                      <div className="makeFlex spaceBetween alignCenter appendBottom8">
                        <div className="makeFlex alignCenter gap8">
                          <span className="font14 fontSemiBold">
                            {INTERACTION_TYPES.find(t => t.value === interaction.type)?.label || interaction.type}
                          </span>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: interaction.status === 'completed' ? '#28a745' : '#ffc107',
                              color: '#fff',
                              fontSize: '10px',
                            }}
                          >
                            {interaction.status}
                          </span>
                        </div>
                        <span className="font12 grayText">{formatDateTime(interaction.createdAt)}</span>
                      </div>
                      {interaction.subject && interaction.subject !== "Note" && (
                        <div className="font14 fontSemiBold appendBottom4">{interaction.subject}</div>
                      )}
                      {interaction.description && (
                        <div className="font14" style={{ whiteSpace: 'pre-wrap' }}>{interaction.description}</div>
                      )}
                      {interaction.createdBy && (
                        <div className="font12 grayText appendTop8">By: {interaction.createdBy.name || interaction.createdBy.email}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid #e0e0e0', backgroundColor: '#f9f9f9' }}>
              <button onClick={closeInteractionModal} className="btnSecondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Popup */}
      <DeleteConfirmationPopup
        isVisible={deletePopup.isVisible}
        message={deletePopup.message}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletePopup({ isVisible: false, clientId: null, message: "", isPermanentDelete: false, action: "delete" })}
        confirmText={deletePopup.isPermanentDelete ? "Delete Forever" : "Delete"}
        cancelText="Cancel"
        loading={loading}
      />
    </div>
  );
};

export default ClientManager;
