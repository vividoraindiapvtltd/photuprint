import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import api from "../api/axios"
import { PageHeader, AlertMessage, ViewToggle, Pagination, EntityCard, EntityCardHeader, FormField, ActionButtons, SearchField, StatusFilter, DeleteConfirmationPopup, calculateStandardStatusCounts, filterEntitiesByStatus, generateEntityColor } from "../common"

const WebsiteManager = () => {
  const [websites, setWebsites] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [viewMode, setViewMode] = useState("card")
  const [statusFilter, setStatusFilter] = useState("all")

  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    websiteId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete",
  })

  const formRef = useRef(null)
  const websiteNameInputRef = useRef(null)

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [hasMoreCards, setHasMoreCards] = useState(true)
  const [displayedCards, setDisplayedCards] = useState([])

  const [showCredentials, setShowCredentials] = useState(false)

  const initialFormData = {
    name: "",
    domain: "",
    description: "",
    isActive: true,
    razorpayKeyId: "",
    razorpayKeySecret: "",
    cloudinaryUrl: "",
    cloudinaryCloudName: "",
    cloudinaryApiKey: "",
    cloudinaryApiSecret: "",
  }

  const [formData, setFormData] = useState(initialFormData)
  const [searchQuery, setSearchQuery] = useState("")

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target

    if (type === "checkbox") {
      setFormData({ ...formData, [name]: checked })
    } else {
      setFormData({ ...formData, [name]: value })
    }
  }

  const validateWebsiteName = (name) => {
    if (!name || !name.trim()) {
      return { isValid: false, error: "Website name is required" }
    }

    const existingWebsite = websites.find((website) => website.name.toLowerCase().trim() === name.toLowerCase().trim() && website._id !== editingId && website.isActive === true && !website.deleted)

    if (existingWebsite) {
      return { isValid: false, error: "Website name already exists" }
    }

    return { isValid: true, error: "" }
  }

  const validateDomain = (domain) => {
    if (!domain || !domain.trim()) {
      return { isValid: false, error: "Domain is required" }
    }

    // Basic domain validation
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i
    if (!domainRegex.test(domain.trim())) {
      return { isValid: false, error: "Please enter a valid domain (e.g., example.com)" }
    }

    const existingWebsite = websites.find((website) => website.domain.toLowerCase().trim() === domain.toLowerCase().trim() && website._id !== editingId && !website.deleted)

    if (existingWebsite) {
      return { isValid: false, error: "Domain already exists" }
    }

    return { isValid: true, error: "" }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const nameValidation = validateWebsiteName(formData.name)
    if (!nameValidation.isValid) {
      setError(nameValidation.error)
      return
    }

    const domainValidation = validateDomain(formData.domain)
    if (!domainValidation.isValid) {
      setError(domainValidation.error)
      return
    }

    try {
      setLoading(true)
      setSuccess("")
      setError("")

      const websiteData = {
        name: formData.name.trim(),
        domain: formData.domain.trim().toLowerCase(),
        description: formData.description?.trim() || "",
        isActive: formData.isActive,
        razorpayKeyId: formData.razorpayKeyId?.trim() || "",
        cloudinaryCloudName: formData.cloudinaryCloudName?.trim() || "",
        cloudinaryApiKey: formData.cloudinaryApiKey?.trim() || "",
      }
      // Only send secret fields if the user typed a new value (not empty)
      if (formData.razorpayKeySecret?.trim()) {
        websiteData.razorpayKeySecret = formData.razorpayKeySecret.trim()
      }
      if (formData.cloudinaryApiSecret?.trim()) {
        websiteData.cloudinaryApiSecret = formData.cloudinaryApiSecret.trim()
      }
      if (formData.cloudinaryUrl?.trim()) {
        websiteData.cloudinaryUrl = formData.cloudinaryUrl.trim()
      }

      if (editingId) {
        await api.put(`/websites/${editingId}`, websiteData)
        setSuccess(`✅ Website "${websiteData.name}" has been updated successfully!`)
      } else {
        await api.post("/websites", websiteData)
        setSuccess(`✅ Website "${websiteData.name}" has been created successfully!`)
      }

      await fetchWebsites()
      resetForm()
    } catch (err) {
      console.error("Error submitting website:", err)
      if (err.response?.data?.msg?.includes("already exists")) {
        setError(`❌ ${err.response.data.msg}`)
      } else {
        const errorMsg = err.response?.data?.msg || err.message || "Please try again."
        setError(`❌ Failed to ${editingId ? "update" : "create"} website. ${errorMsg}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData(initialFormData)
    setEditingId(null)
    setError("")
    setShowCredentials(false)
  }

  const clearForm = () => {
    setFormData(initialFormData)
    setEditingId(null)
    setError("")
    setSuccess("")
    setShowCredentials(false)
  }

  const handleEdit = (website) => {
    setFormData({
      ...initialFormData,
      name: website.name || "",
      domain: website.domain || "",
      description: website.description || "",
      isActive: website.isActive !== undefined ? website.isActive : true,
      razorpayKeyId: website.razorpayKeyId || "",
      razorpayKeySecret: "",
      cloudinaryUrl: "",
      cloudinaryCloudName: website.cloudinaryCloudName || "",
      cloudinaryApiKey: website.cloudinaryApiKey || "",
      cloudinaryApiSecret: "",
    })
    setShowCredentials(
      !!(
        website.razorpayKeyId ||
        website.razorpayKeySecret ||
        website.cloudinaryUrl ||
        website.cloudinaryCloudName ||
        website.cloudinaryApiKey ||
        website.cloudinaryApiSecret
      )
    )
    setEditingId(website._id || website.id)
    setError("")
    setSuccess("")

    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
      }
      if (websiteNameInputRef.current) {
        websiteNameInputRef.current.focus()
      }
    }, 100)
  }

  const handleDelete = (websiteId) => {
    const website = websites.find((w) => w._id === websiteId)
    const isAlreadyDeleted = website?.deleted

    setDeletePopup({
      isVisible: true,
      websiteId,
      message: isAlreadyDeleted ? "This website is already marked as deleted. Click OK to permanently remove it from the database. This action cannot be undone." : "This will mark the website as inactive and add a deleted flag. Click OK to continue.",
      isPermanentDelete: isAlreadyDeleted,
      action: "delete",
    })
  }

  const handleDeleteConfirm = async () => {
    const { websiteId, isPermanentDelete } = deletePopup
    const website = websites.find((w) => w._id === websiteId)

    try {
      setLoading(true)
      setSuccess("")
      setError("")

      if (isPermanentDelete) {
        await api.delete(`/websites/${websiteId}/hard`)
        setSuccess(`🗑️ Website "${website.name}" has been permanently deleted from the database.`)
      } else {
        await api.delete(`/websites/${websiteId}`)
        setSuccess(`⏸️ Website "${website.name}" has been marked as deleted and inactive.`)
      }

      await fetchWebsites()
    } catch (err) {
      const action = isPermanentDelete ? "permanently delete" : "mark as deleted"
      setError(`❌ Failed to ${action} website "${website.name}". ${err.response?.data?.msg || "Please try again."}`)
    } finally {
      setLoading(false)
      setDeletePopup({
        isVisible: false,
        websiteId: null,
        message: "",
        isPermanentDelete: false,
        action: "delete",
      })
    }
  }

  const handleDeleteCancel = () => {
    setDeletePopup({
      isVisible: false,
      websiteId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete",
    })
  }

  const handleRevert = async (websiteId) => {
    const website = websites.find((w) => w._id === websiteId)

    if (!website) {
      setError("Website not found")
      return
    }

    if (!website.deleted) {
      setError("This website is not deleted")
      return
    }

    setDeletePopup({
      isVisible: true,
      websiteId,
      message: `Are you sure you want to restore the website "${website.name}"? This will make it active again.`,
      isPermanentDelete: false,
      action: "revert",
    })
  }

  const handleRevertConfirm = async () => {
    const { websiteId } = deletePopup
    const website = websites.find((w) => w._id === websiteId)

    try {
      setLoading(true)
      setSuccess("")
      setError("")

      const existingWebsite = websites.find((w) => w._id !== websiteId && w.domain.toLowerCase().trim() === website.domain.toLowerCase().trim() && !w.deleted)

      if (existingWebsite) {
        const status = existingWebsite.isActive ? "Active" : "Inactive"
        setError(`❌ Cannot restore website "${website.name}". A ${status.toLowerCase()} website with domain "${website.domain}" already exists.`)
        setLoading(false)
        setDeletePopup({
          isVisible: false,
          websiteId: null,
          message: "",
          isPermanentDelete: false,
          action: "delete",
        })
        return
      }

      await api.put(`/websites/${websiteId}`, {
        name: website.name,
        domain: website.domain,
        description: website.description,
        isActive: true,
        deleted: false,
      })

      setSuccess(`✅ Website "${website.name}" has been restored and is now active!`)
      await fetchWebsites()
    } catch (err) {
      setError(`❌ Failed to restore website "${website.name}". ${err.response?.data?.msg || "Please try again."}`)
    } finally {
      setLoading(false)
      setDeletePopup({
        isVisible: false,
        websiteId: null,
        message: "",
        isPermanentDelete: false,
        action: "delete",
      })
    }
  }

  const handleRevertCancel = () => {
    setDeletePopup({
      isVisible: false,
      websiteId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete",
    })
  }

  const fetchWebsites = async () => {
    try {
      setLoading(true)
      const response = await api.get("/websites?showInactive=true&includeDeleted=true")
      setWebsites(response.data)
      setError("")
    } catch (err) {
      setError("Failed to fetch websites")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWebsites()
  }, [])

  const filteredWebsites = useMemo(() => {
    let filtered = websites

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter((website) => website.name.toLowerCase().includes(query) || website.domain.toLowerCase().includes(query) || (website.description && website.description.toLowerCase().includes(query)))
    }

    filtered = filterEntitiesByStatus(filtered, statusFilter)

    return filtered
  }, [websites, searchQuery, statusFilter])

  const totalPages = Math.ceil(filteredWebsites.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentWebsites = filteredWebsites.slice(startIndex, endIndex)

  useEffect(() => {
    if (viewMode === "card") {
      const initialCards = filteredWebsites.slice(0, 12)
      setDisplayedCards(initialCards)
      setHasMoreCards(filteredWebsites.length > 12)
      setCurrentPage(1)
    }
  }, [viewMode, filteredWebsites])

  const resetPaginationForSearch = useCallback(() => {
    setCurrentPage(1)
    if (viewMode === "card") {
      const initialCards = filteredWebsites.slice(0, 12)
      setDisplayedCards(initialCards)
      setHasMoreCards(filteredWebsites.length > 12)
    }
  }, [viewMode, filteredWebsites.length])

  useEffect(() => {
    resetPaginationForSearch()
  }, [searchQuery, resetPaginationForSearch])

  const handlePageChange = useCallback((pageNumber) => {
    setCurrentPage(pageNumber)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const handleLoadMoreCards = useCallback(() => {
    setDisplayedCards((prevCards) => {
      const currentCardCount = prevCards.length
      const nextCards = filteredWebsites.slice(currentCardCount, currentCardCount + 12)

      if (nextCards.length > 0) {
        setHasMoreCards(currentCardCount + nextCards.length < filteredWebsites.length)
        return [...prevCards, ...nextCards]
      } else {
        setHasMoreCards(false)
        return prevCards
      }
    })
  }, [filteredWebsites])

  const handleViewModeChange = useCallback(
    (mode) => {
      setViewMode(mode)
      setCurrentPage(1)
      if (mode === "card") {
        const initialCards = filteredWebsites.slice(0, 12)
        setDisplayedCards(initialCards)
        setHasMoreCards(filteredWebsites.length > 12)
      }
    },
    [filteredWebsites.length],
  )

  const handleCancel = () => {
    resetForm()
  }

  return (
    <div className="paddingAll20">
      <PageHeader title="Website Management" subtitle="Manage multiple websites for multi-tenant support" isEditing={!!editingId} editText="Edit Website" createText="Add New Website" />

      <AlertMessage type="success" message={success} onClose={() => setSuccess("")} autoClose={true} />
      <AlertMessage type="error" message={error} onClose={() => setError("")} autoClose={true} />

      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        <form onSubmit={handleSubmit} className="brandForm">
          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField ref={websiteNameInputRef} type="text" name="name" label="Website Name" value={formData.name} onChange={handleChange} placeholder="Enter Website Name (e.g., PhotuPrint Main Site)" required={true} />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField type="text" name="domain" label="Domain" value={formData.domain} onChange={handleChange} placeholder="Enter domain (e.g., photuprint.com)" required={true} info="Domain will be automatically converted to lowercase" />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="fullWidth">
              <FormField type="textarea" name="description" label="Description" value={formData.description} onChange={handleChange} placeholder="Enter website description (optional)" rows={3} />
            </div>
          </div>

          <div className="makeFlex row gap10">
            <div className="makeFlex column appendBottom16">
              <label className="formLabel appendBottom10">Status:</label>
              <label className="appendBottom8 makeFlex gap10">
                <FormField type="checkbox" name="isActive" checked={formData.isActive} onChange={handleChange} />
                Active
              </label>
              <p className="negativeMarginTop10">Check this box to keep the website active, uncheck to mark as inactive</p>
            </div>
          </div>

          {/* Collapsible credentials section */}
          <div className="appendBottom16">
            <button type="button" className="btnSecondary" style={{ marginBottom: 12, fontSize: 14 }} onClick={() => setShowCredentials((prev) => !prev)}>
              {showCredentials ? "Hide" : "Show"} API Credentials (Razorpay &amp; Cloudinary)
            </button>

            {showCredentials && (
              <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 20, background: "#fafafa" }}>
                <p className="font14 grayText appendBottom16">Leave fields blank to use the global environment credentials. Only fill these if this website needs its own keys. Secret fields are masked after saving — re-enter the full secret to change it.</p>

                <h4 className="font16 fontSemiBold appendBottom12">Razorpay</h4>
                <div className="makeFlex row gap10">
                  <div className="fullWidth">
                    <FormField type="text" name="razorpayKeyId" label="Razorpay Key ID" value={formData.razorpayKeyId} onChange={handleChange} placeholder="e.g. rzp_live_xxxxxxxx or rzp_test_xxxxxxxx" />
                  </div>
                  <div className="fullWidth">
                    <FormField type="password" name="razorpayKeySecret" label="Razorpay Key Secret" value={formData.razorpayKeySecret} onChange={handleChange} placeholder={editingId ? "(unchanged — enter new value to replace)" : "Razorpay Key Secret"} />
                  </div>
                </div>

                <h4 className="font16 fontSemiBold appendBottom12 paddingTop16">Cloudinary</h4>
                <p className="font13 grayText appendBottom12">
                  Use either a single <strong>CLOUDINARY_URL</strong> (<code className="text-xs">cloudinary://...</code>) or the three fields below. URL is preferred when both are set. Leave blank to use server environment variables.
                </p>
                <div className="makeFlex column appendBottom16 fullWidth">
                  <FormField
                    type="password"
                    name="cloudinaryUrl"
                    label="Cloudinary URL (optional)"
                    value={formData.cloudinaryUrl}
                    onChange={handleChange}
                    placeholder={editingId ? "(unchanged — enter new URL to replace)" : "cloudinary://API_KEY:API_SECRET@CLOUD_NAME"}
                  />
                </div>
                <div className="makeFlex row gap10">
                  <div className="fullWidth">
                    <FormField type="text" name="cloudinaryCloudName" label="Cloud Name" value={formData.cloudinaryCloudName} onChange={handleChange} placeholder="e.g. dxxxxxx" />
                  </div>
                  <div className="fullWidth">
                    <FormField type="text" name="cloudinaryApiKey" label="API Key" value={formData.cloudinaryApiKey} onChange={handleChange} placeholder="Cloudinary API Key" />
                  </div>
                  <div className="fullWidth">
                    <FormField type="password" name="cloudinaryApiSecret" label="API Secret" value={formData.cloudinaryApiSecret} onChange={handleChange} placeholder={editingId ? "(unchanged — enter new value to replace)" : "Cloudinary API Secret"} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="formActions paddingTop16">
            <button type="submit" disabled={loading} className="btnPrimary">
              {loading ? <span className="loadingSpinner">⏳</span> : <span>{editingId ? "Update Website" : "Add Website"}</span>}
            </button>

            {(editingId || (!editingId && (formData.name || formData.domain))) && (
              <button type="button" onClick={handleCancel} className="btnSecondary">
                Cancel
              </button>
            )}

            {!editingId && success && (
              <button type="button" onClick={clearForm} className="btnSecondary">
                Add Another Website
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">Websites ({filteredWebsites?.length || 0})</h2>
            <StatusFilter statusFilter={statusFilter} onStatusChange={setStatusFilter} counts={calculateStandardStatusCounts(websites)} disabled={loading} />
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search websites..." disabled={loading} minWidth="250px" />
            {loading && <div className="loadingIndicator grayText">Loading...</div>}
            <ViewToggle viewMode={viewMode} onViewChange={handleViewModeChange} disabled={loading} />
          </div>
        </div>

        {filteredWebsites.length === 0 && !loading ? (
          <div className="emptyState textCenter paddingAll60">
            <div className="emptyIcon appendBottom16">🌐</div>
            <h3 className="font22 fontSemiBold grayText appendBottom8">No Websites Found</h3>
            <p className="font16 grayText">Start by adding your first website above</p>
          </div>
        ) : (
          <>
            {viewMode === "card" && (
              <div className="brandsGrid">
                {displayedCards.map((website) => (
                  <EntityCard
                    key={website._id || website.id}
                    entity={website}
                    logoField="logo"
                    nameField="name"
                    idField="_id"
                    onEdit={website.deleted ? undefined : handleEdit}
                    onDelete={handleDelete}
                    onRevert={website.deleted ? () => handleRevert(website._id || website.id) : undefined}
                    loading={loading}
                    imagePlaceholderColor={generateEntityColor(website._id || website.id, website.name)}
                    renderHeader={(website) => <EntityCardHeader entity={website} imageField="logo" titleField="name" dateField="createdAt" generateColor={generateEntityColor} />}
                    renderDetails={(website) => {
                      return (
                        <>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Website ID:</span>
                            <span className="detailValue font14 blackText appendLeft6">{website._id || "N/A"}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Domain:</span>
                            <span className="detailValue font14 blackText appendLeft6 fontBold">{website.domain}</span>
                          </div>
                          {website.description && (
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Description:</span>
                              <span className="detailValue font14 blackText appendLeft6">{website.description}</span>
                            </div>
                          )}
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                            <span className={`detailValue font14 ${website.deleted ? "deleted" : website.isActive ? "greenText" : "inactive"} appendLeft6`}>{website.deleted ? "Deleted" : website.isActive ? "Active" : "Inactive"}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Razorpay:</span>
                            <span className={`detailValue font14 ${website.razorpayKeyId ? "greenText" : "grayText"} appendLeft6`}>{website.razorpayKeyId ? "Custom Key" : "Global (env)"}</span>
                          </div>
                          <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                            <span className="detailLabel font14 fontSemiBold grayText textUppercase">Cloudinary:</span>
                            <span
                              className={`detailValue font14 ${website.cloudinaryUrl || website.cloudinaryCloudName ? "greenText" : "grayText"} appendLeft6`}
                            >
                              {website.cloudinaryUrl ? "Custom URL" : website.cloudinaryCloudName ? "Custom (name/key)" : "Global (env)"}
                            </span>
                          </div>
                        </>
                      )
                    }}
                    renderActions={(website) => <ActionButtons onEdit={website.deleted ? undefined : () => handleEdit(website)} onDelete={() => handleDelete(website._id || website.id)} onRevert={website.deleted ? () => handleRevert(website._id || website.id) : undefined} loading={loading} size="normal" editText="✏️ Edit" deleteText={website.deleted ? "🗑️ Final Del" : "🗑️ Delete"} revertText="🔄 Undelete" editTitle="Edit Website" deleteTitle={website.deleted ? "Final Del" : "Delete Website"} revertTitle="Restore Website" />}
                    className="brandCard"
                  />
                ))}
                {hasMoreCards && (
                  <div className="loadMoreContainer textCenter paddingAll20">
                    <button onClick={handleLoadMoreCards} className="btnPrimary" disabled={loading}>
                      {loading ? <span className="loadingSpinner">⏳</span> : <span>Load More</span>}
                    </button>
                  </div>
                )}
              </div>
            )}

            {viewMode === "list" && (
              <div className="brandsListTable">
                <div className="tableContainer">
                  <table className="brandsTable">
                    <thead>
                      <tr>
                        <th className="tableHeader">Name</th>
                        <th className="tableHeader">Domain</th>
                        <th className="tableHeader">Description</th>
                        <th className="tableHeader">Status</th>
                        <th className="tableHeader">Created</th>
                        <th className="tableHeader">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentWebsites.map((website) => (
                        <tr key={website._id || website.id} className="tableRow">
                          <td className="tableCell">
                            <span className="brandNameText">{website.name}</span>
                          </td>
                          <td className="tableCell">
                            <span className="brandNameText fontBold">{website.domain}</span>
                          </td>
                          <td className="tableCell">
                            <span className="addressText" title={website.description}>
                              {website.description ? (website.description.length > 30 ? `${website.description.substring(0, 30)}...` : website.description) : "-"}
                            </span>
                          </td>
                          <td className="tableCell">
                            <span className={`statusText ${website.deleted ? "deleted" : website.isActive ? "active" : "inactive"}`}>{website.deleted ? "Deleted" : website.isActive ? "Active" : "Inactive"}</span>
                          </td>
                          <td className="tableCell">
                            <span className="dateText">{new Date(website.createdAt).toLocaleDateString()}</span>
                          </td>
                          <td className="tableCell">
                            <div className="tableActions makeFlex gap8">
                              <ActionButtons onEdit={website.deleted ? undefined : () => handleEdit(website)} onDelete={() => handleDelete(website._id || website.id)} onRevert={website.deleted ? () => handleRevert(website._id || website.id) : undefined} loading={loading} size="small" editText="✏️" deleteText={website.deleted ? "🗑️" : "🗑️"} revertText="🔄" editTitle="Edit Website" deleteTitle={website.deleted ? "Final Del" : "Delete Website"} revertTitle="Restore Website" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} disabled={loading} showGoToPage={true} />}
              </div>
            )}
          </>
        )}
      </div>

      <DeleteConfirmationPopup isVisible={deletePopup.isVisible} message={deletePopup.message} onConfirm={deletePopup.action === "delete" ? handleDeleteConfirm : handleRevertConfirm} onCancel={deletePopup.action === "delete" ? handleDeleteCancel : handleRevertCancel} action={deletePopup.action} isPermanentDelete={deletePopup.isPermanentDelete} />
    </div>
  )
}

export default WebsiteManager
