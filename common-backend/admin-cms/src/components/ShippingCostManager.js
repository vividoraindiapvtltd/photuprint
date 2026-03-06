import React, { useState, useEffect, useMemo, useRef } from "react"
import api from '../api/axios'
import { 
  PageHeader, 
  AlertMessage, 
  ViewToggle,
  Pagination,
  EntityCard,
  EntityCardHeader,
  FormField, 
  ActionButtons,
  SearchField,
  StatusFilter,
  calculateStandardStatusCounts,
  filterEntitiesByStatus,
  DeleteConfirmationPopup,
  generateBrandColor
} from '../common'

const ShippingCostManager = () => {
  const [activeTab, setActiveTab] = useState('zones')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [viewMode, setViewMode] = useState('card')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [hasMoreCards, setHasMoreCards] = useState(true)
  const [displayedCards, setDisplayedCards] = useState([])
  
  // Zones state
  const [zones, setZones] = useState([])
  const [editingZoneId, setEditingZoneId] = useState(null)
  const [zoneFormData, setZoneFormData] = useState({ name: "", description: "", isActive: true })
  
  // Rates state
  const [rates, setRates] = useState([])
  const [editingRateId, setEditingRateId] = useState(null)
  const [rateFormData, setRateFormData] = useState({
    zone: "",
    minWeight: 0,
    maxWeight: 500,
    rate: 0,
    additionalWeight: 500,
    additionalRate: 0,
    isActive: true
  })
  
  // Config state
  const [config, setConfig] = useState({
    codSurcharge: 0,
    codSurchargeType: "fixed",
    freeShippingThreshold: 0
  })
  
  // Pincode mappings state
  const [mappings, setMappings] = useState([])
  const [editingMappingId, setEditingMappingId] = useState(null)
  const [mappingFormData, setMappingFormData] = useState({
    pincode: "",
    zone: "",
    state: "",
    city: "",
    isActive: true
  })
  
  // Delete popup state
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    id: null,
    type: null,
    message: ""
  })
  
  const formRef = useRef(null)

  useEffect(() => {
    fetchZones()
    fetchRates()
    fetchConfig()
    fetchMappings()
  }, [])

  const fetchZones = async () => {
    try {
      const response = await api.get('/shipping-zones?showInactive=true&includeDeleted=true')
      setZones(response.data || [])
      setError("")
    } catch (err) {
      const errorMessage = err.response?.data?.msg || 'Failed to fetch shipping zones'
      setError(errorMessage)
      console.error('Fetch zones error:', err)
    }
  }

  const fetchRates = async () => {
    try {
      const response = await api.get('/shipping-rates?showInactive=true&includeDeleted=true')
      setRates(response.data || [])
    } catch (err) {
      setError('Failed to fetch shipping rates')
    }
  }

  const fetchConfig = async () => {
    try {
      const response = await api.get('/shipping-config')
      if (response.data) {
        setConfig(response.data)
      }
    } catch (err) {
      setError('Failed to fetch shipping config')
    }
  }

  const fetchMappings = async () => {
    try {
      const response = await api.get('/pincode-zone-mappings?showInactive=true&includeDeleted=true')
      setMappings(response.data || [])
    } catch (err) {
      setError('Failed to fetch pincode mappings')
    }
  }

  const handleZoneSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError("")
      setSuccess("")

      if (editingZoneId) {
        await api.put(`/shipping-zones/${editingZoneId}`, zoneFormData)
        setSuccess('Shipping zone updated successfully')
      } else {
        await api.post('/shipping-zones', zoneFormData)
        setSuccess('Shipping zone created successfully')
      }

      setZoneFormData({ name: "", description: "", isActive: true })
      setEditingZoneId(null)
      await fetchZones()
    } catch (err) {
      const errorMessage = err.response?.data?.msg || err.message || 'Failed to save shipping zone'
      setError(errorMessage)
      console.error('Zone submission error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRateSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError("")
      setSuccess("")

      if (!rateFormData.zone) {
        setError('Please select a zone')
        return
      }

      if (editingRateId) {
        await api.put(`/shipping-rates/${editingRateId}`, rateFormData)
        setSuccess('Shipping rate updated successfully')
      } else {
        await api.post('/shipping-rates', rateFormData)
        setSuccess('Shipping rate created successfully')
      }

      setRateFormData({
        zone: "",
        minWeight: 0,
        maxWeight: 500,
        rate: 0,
        additionalWeight: 500,
        additionalRate: 0,
        isActive: true
      })
      setEditingRateId(null)
      fetchRates()
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to save shipping rate')
    } finally {
      setLoading(false)
    }
  }

  const handleConfigSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError("")
      setSuccess("")

      await api.put('/shipping-config', config)
      setSuccess('Shipping configuration updated successfully')
      fetchConfig()
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to update shipping config')
    } finally {
      setLoading(false)
    }
  }

  const handleMappingSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError("")
      setSuccess("")

      if (!mappingFormData.pincode || !mappingFormData.zone) {
        setError('Pincode and zone are required')
        return
      }

      if (!/^[0-9]{6}$/.test(mappingFormData.pincode)) {
        setError('Pincode must be exactly 6 digits')
        return
      }

      if (editingMappingId) {
        await api.put(`/pincode-zone-mappings/${editingMappingId}`, mappingFormData)
        setSuccess('Pincode mapping updated successfully')
      } else {
        await api.post('/pincode-zone-mappings', mappingFormData)
        setSuccess('Pincode mapping created successfully')
      }

      setMappingFormData({
        pincode: "",
        zone: "",
        state: "",
        city: "",
        isActive: true
      })
      setEditingMappingId(null)
      fetchMappings()
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to save pincode mapping')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (item, type) => {
    if (type === 'zone') {
      setEditingZoneId(item._id)
      setZoneFormData({
        name: item.name,
        description: item.description || "",
        isActive: item.isActive
      })
    } else if (type === 'rate') {
      setEditingRateId(item._id)
      setRateFormData({
        zone: item.zone._id || item.zone,
        minWeight: item.minWeight,
        maxWeight: item.maxWeight,
        rate: item.rate,
        additionalWeight: item.additionalWeight || 500,
        additionalRate: item.additionalRate || 0,
        isActive: item.isActive
      })
    } else if (type === 'mapping') {
      setEditingMappingId(item._id)
      setMappingFormData({
        pincode: item.pincode,
        zone: item.zone._id || item.zone,
        state: item.state || "",
        city: item.city || "",
        isActive: item.isActive
      })
    }
    
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        })
      }
    }, 100)
  }

  const handleDelete = (id, type, name) => {
    setDeletePopup({
      isVisible: true,
      id,
      type,
      message: `Are you sure you want to delete ${name}?`
    })
  }

  const handleDeleteConfirm = async () => {
    try {
      setLoading(true)
      const { id, type } = deletePopup

      if (type === 'zone') {
        await api.delete(`/shipping-zones/${id}`)
        setSuccess('Shipping zone deleted successfully')
        fetchZones()
      } else if (type === 'rate') {
        await api.delete(`/shipping-rates/${id}`)
        setSuccess('Shipping rate deleted successfully')
        fetchRates()
      } else if (type === 'mapping') {
        await api.delete(`/pincode-zone-mappings/${id}`)
        setSuccess('Pincode mapping deleted successfully')
        fetchMappings()
      }

      setDeletePopup({ isVisible: false, id: null, type: null, message: "" })
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to delete')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCancel = () => {
    setDeletePopup({ isVisible: false, id: null, type: null, message: "" })
  }

  const resetForm = (type) => {
    if (type === 'zone') {
      setZoneFormData({ name: "", description: "", isActive: true })
      setEditingZoneId(null)
    } else if (type === 'rate') {
      setRateFormData({
        zone: "",
        minWeight: 0,
        maxWeight: 500,
        rate: 0,
        additionalWeight: 500,
        additionalRate: 0,
        isActive: true
      })
      setEditingRateId(null)
    } else if (type === 'mapping') {
      setMappingFormData({
        pincode: "",
        zone: "",
        state: "",
        city: "",
        isActive: true
      })
      setEditingMappingId(null)
    }
  }

  // Filter and pagination logic for zones
  const filteredZones = useMemo(() => {
    let filtered = zones
    filtered = filterEntitiesByStatus(filtered, statusFilter)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(zone => 
        zone.name.toLowerCase().includes(query) ||
        (zone.description && zone.description.toLowerCase().includes(query))
      )
    }
    return filtered
  }, [zones, searchQuery, statusFilter])

  const totalPagesZones = Math.ceil(filteredZones.length / itemsPerPage)
  const startIndexZones = (currentPage - 1) * itemsPerPage
  const endIndexZones = startIndexZones + itemsPerPage
  const currentZones = filteredZones.slice(startIndexZones, endIndexZones)

  useEffect(() => {
    if (activeTab === 'zones') {
      if (viewMode === 'card') {
        const initialCards = filteredZones.slice(0, 16)
        setDisplayedCards(initialCards)
        setHasMoreCards(filteredZones.length > 16)
      }
      setCurrentPage(1)
    }
  }, [filteredZones, viewMode, activeTab])

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleLoadMoreCards = () => {
    const currentCardCount = displayedCards.length
    const nextCards = filteredZones.slice(currentCardCount, currentCardCount + 16)
    
    if (nextCards.length > 0) {
      setDisplayedCards([...displayedCards, ...nextCards])
      setHasMoreCards(currentCardCount + nextCards.length < filteredZones.length)
    } else {
      setHasMoreCards(false)
    }
  }

  const handleViewModeChange = (mode) => {
    setViewMode(mode)
    setCurrentPage(1)
    if (mode === 'card' && activeTab === 'zones') {
      const initialCards = filteredZones.slice(0, 16)
      setDisplayedCards(initialCards)
      setHasMoreCards(filteredZones.length > 16)
    }
  }

  // Filter and pagination for rates
  const filteredRates = useMemo(() => {
    let filtered = rates
    filtered = filterEntitiesByStatus(filtered, statusFilter)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(rate => 
        rate.zone?.name?.toLowerCase().includes(query) ||
        rate.minWeight.toString().includes(query) ||
        rate.maxWeight.toString().includes(query) ||
        rate.rate.toString().includes(query)
      )
    }
    return filtered
  }, [rates, searchQuery, statusFilter])

  const totalPagesRates = Math.ceil(filteredRates.length / itemsPerPage)
  const startIndexRates = (currentPage - 1) * itemsPerPage
  const endIndexRates = startIndexRates + itemsPerPage
  const currentRates = filteredRates.slice(startIndexRates, endIndexRates)

  // Filter and pagination for mappings
  const filteredMappings = useMemo(() => {
    let filtered = mappings
    filtered = filterEntitiesByStatus(filtered, statusFilter)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(mapping => 
        mapping.pincode.includes(query) ||
        mapping.zone?.name?.toLowerCase().includes(query) ||
        (mapping.state && mapping.state.toLowerCase().includes(query)) ||
        (mapping.city && mapping.city.toLowerCase().includes(query))
      )
    }
    return filtered
  }, [mappings, searchQuery, statusFilter])

  const totalPagesMappings = Math.ceil(filteredMappings.length / itemsPerPage)
  const startIndexMappings = (currentPage - 1) * itemsPerPage
  const endIndexMappings = startIndexMappings + itemsPerPage
  const currentMappings = filteredMappings.slice(startIndexMappings, endIndexMappings)

  const activeZones = useMemo(() => zones.filter(z => z.isActive && !z.deleted), [zones])

  const tabs = [
    { id: 'zones', label: 'Shipping Zones', icon: '📍' },
    { id: 'rates', label: 'Shipping Rates', icon: '💰' },
    { id: 'config', label: 'Configuration', icon: '⚙️' },
    { id: 'mappings', label: 'Pincode Mappings', icon: '🗺️' }
  ]

  const getCurrentData = () => {
    if (activeTab === 'zones') return { items: filteredZones, counts: calculateStandardStatusCounts(zones) }
    if (activeTab === 'rates') return { items: filteredRates, counts: calculateStandardStatusCounts(rates) }
    if (activeTab === 'mappings') return { items: filteredMappings, counts: calculateStandardStatusCounts(mappings) }
    return { items: [], counts: { all: 0, active: 0, inactive: 0, deleted: 0 } }
  }

  const { items: currentItems, counts } = getCurrentData()

  return (
    <div className="paddingAll20">
      <PageHeader
        title="Shipping Cost Manager"
        subtitle="Manage shipping zones, rates, and pincode mappings for India"
        isEditing={!!(editingZoneId || editingRateId || editingMappingId)}
        editText="Edit"
        createText="Add New"
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
      />

      {/* Form Container with Tabs */}
      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        {/* Tabs */}
        <div style={{ 
          display: 'flex', 
          gap: '0', 
          borderBottom: '2px solid #e5e7eb',
          marginBottom: '24px',
          marginTop: '-24px',
          marginLeft: '-32px',
          marginRight: '-32px'
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id)
                setCurrentPage(1)
                setSearchQuery("")
                setStatusFilter('all')
              }}
              style={{
                padding: '12px 24px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: activeTab === tab.id ? '600' : '400',
                color: activeTab === tab.id ? '#007bff' : '#666',
                borderBottom: activeTab === tab.id ? '3px solid #007bff' : '3px solid transparent',
                marginBottom: '-2px',
                transition: 'all 0.2s'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Zones Tab Form */}
        {activeTab === 'zones' && (
            <form onSubmit={handleZoneSubmit} className="brandForm">
              <div className="makeFlex row gap10">
                <div className="fullWidth">
                  <FormField
                    type="select"
                    name="name"
                    label="Zone Name"
                    value={zoneFormData.name}
                    onChange={(e) => setZoneFormData({ ...zoneFormData, name: e.target.value })}
                    required={true}
                    disabled={!!editingZoneId}
                    options={[
                      { value: "", label: "Select Zone" },
                      { value: "Local", label: "Local" },
                      { value: "Zonal", label: "Zonal" },
                      { value: "Metro", label: "Metro" },
                      { value: "Rest of India", label: "Rest of India" },
                      { value: "Remote/North East/J&K", label: "Remote/North East/J&K" }
                    ]}
                  />
                </div>
              </div>

              <div className="makeFlex row gap10">
                <div className="fullWidth">
                  <FormField
                    type="textarea"
                    name="description"
                    label="Description"
                    value={zoneFormData.description}
                    onChange={(e) => setZoneFormData({ ...zoneFormData, description: e.target.value })}
                    placeholder="Enter zone description (optional)"
                    rows={3}
                  />
                </div>
              </div>

              <div className="makeFlex row gap10">
                <div className="makeFlex column flexOne appendBottom16">
                  <label className="formLabel appendBottom10">Status:</label>
                  <label className="formLabel appendBottom8 makeFlex gap10">
                    <FormField
                      type="checkbox"
                      name="isActive"
                      checked={zoneFormData.isActive}
                      onChange={(e) => setZoneFormData({ ...zoneFormData, isActive: e.target.checked })}
                    />
                    Active
                  </label>
                  <p className="negativeMarginTop10">Check this box to keep the zone active, uncheck to mark as inactive</p>
                </div>
              </div>

              <div className="formActions paddingTop16">
                <button type="submit" className="btnPrimary" disabled={loading}>
                  {loading ? 'Saving...' : editingZoneId ? 'Update Zone' : 'Create Zone'}
                </button>
                {editingZoneId && (
                  <button type="button" onClick={() => resetForm('zone')} className="btnSecondary">
                    Cancel
                  </button>
                )}
              </div>
            </form>
        )}

        {/* Rates Tab Form */}
        {activeTab === 'rates' && (
            <form onSubmit={handleRateSubmit} className="brandForm">
              <div className="makeFlex row gap10">
                <div className="fullWidth">
                  <FormField
                    type="select"
                    name="zone"
                    label="Zone"
                    value={rateFormData.zone}
                    onChange={(e) => setRateFormData({ ...rateFormData, zone: e.target.value })}
                    required={true}
                    options={[
                      { value: "", label: "Select Zone" },
                      ...activeZones.map(z => ({ value: z._id, label: z.name }))
                    ]}
                  />
                </div>
              </div>

              <div className="makeFlex row gap16">
                <div className="flexOne">
                  <FormField
                    type="number"
                    name="minWeight"
                    label="Min Weight (grams)"
                    value={rateFormData.minWeight}
                    onChange={(e) => setRateFormData({ ...rateFormData, minWeight: parseFloat(e.target.value) || 0 })}
                    required={true}
                    min="0"
                    step="1"
                  />
                </div>
                <div className="flexOne">
                  <FormField
                    type="number"
                    name="maxWeight"
                    label="Max Weight (grams)"
                    value={rateFormData.maxWeight}
                    onChange={(e) => setRateFormData({ ...rateFormData, maxWeight: parseFloat(e.target.value) || 0 })}
                    required={true}
                    min="0"
                    step="1"
                  />
                </div>
              </div>

              <div className="makeFlex row gap16">
                <div className="flexOne">
                  <FormField
                    type="number"
                    name="rate"
                    label="Base Rate (₹)"
                    value={rateFormData.rate}
                    onChange={(e) => setRateFormData({ ...rateFormData, rate: parseFloat(e.target.value) || 0 })}
                    required={true}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="flexOne">
                  <FormField
                    type="number"
                    name="additionalWeight"
                    label="Additional Weight Slab (grams)"
                    value={rateFormData.additionalWeight}
                    onChange={(e) => setRateFormData({ ...rateFormData, additionalWeight: parseFloat(e.target.value) || 500 })}
                    min="0"
                    step="1"
                    info="Weight increment for additional charges (default: 500g)"
                  />
                </div>
              </div>

              <div className="makeFlex row gap16">
                <div className="flexOne">
                  <FormField
                    type="number"
                    name="additionalRate"
                    label="Additional Rate per Slab (₹)"
                    value={rateFormData.additionalRate}
                    onChange={(e) => setRateFormData({ ...rateFormData, additionalRate: parseFloat(e.target.value) || 0 })}
                    min="0"
                    step="0.01"
                    info="Charge for each additional weight slab"
                  />
                </div>
              </div>

              <div className="makeFlex row gap10">
                <div className="makeFlex column flexOne appendBottom16">
                  <label className="formLabel appendBottom10">Status:</label>
                  <label className="formLabel appendBottom8 makeFlex gap10">
                    <FormField
                      type="checkbox"
                      name="isActive"
                      checked={rateFormData.isActive}
                      onChange={(e) => setRateFormData({ ...rateFormData, isActive: e.target.checked })}
                    />
                    Active
                  </label>
                  <p className="negativeMarginTop10">Check this box to keep the rate active, uncheck to mark as inactive</p>
                </div>
              </div>

              <div className="formActions paddingTop16">
                <button type="submit" className="btnPrimary" disabled={loading}>
                  {loading ? 'Saving...' : editingRateId ? 'Update Rate' : 'Create Rate'}
                </button>
                {editingRateId && (
                  <button type="button" onClick={() => resetForm('rate')} className="btnSecondary">
                    Cancel
                  </button>
                )}
              </div>
            </form>
        )}

        {/* Config Tab Form */}
        {activeTab === 'config' && (
          <form onSubmit={handleConfigSubmit} className="brandForm">
            <div className="makeFlex row gap16">
              <div className="flexOne">
                <FormField
                  type="number"
                  name="codSurcharge"
                  label="COD Surcharge"
                  value={config.codSurcharge}
                  onChange={(e) => setConfig({ ...config, codSurcharge: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.01"
                  info="Additional charge for Cash on Delivery orders"
                />
              </div>
              <div className="flexOne">
                <FormField
                  type="select"
                  name="codSurchargeType"
                  label="COD Surcharge Type"
                  value={config.codSurchargeType}
                  onChange={(e) => setConfig({ ...config, codSurchargeType: e.target.value })}
                  options={[
                    { value: "fixed", label: "Fixed Amount (₹)" },
                    { value: "percentage", label: "Percentage (%)" }
                  ]}
                />
              </div>
            </div>

            <div className="makeFlex row gap10">
              <div className="fullWidth">
                <FormField
                  type="number"
                  name="freeShippingThreshold"
                  label="Free Shipping Threshold (₹)"
                  value={config.freeShippingThreshold}
                  onChange={(e) => setConfig({ ...config, freeShippingThreshold: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.01"
                  info="Minimum order value for free shipping (0 = disabled)"
                />
              </div>
            </div>

            <div className="formActions paddingTop16">
              <button type="submit" className="btnPrimary" disabled={loading}>
                {loading ? 'Saving...' : 'Update Configuration'}
              </button>
            </div>
          </form>
        )}

        {/* Mappings Tab Form */}
        {activeTab === 'mappings' && (
          <form onSubmit={handleMappingSubmit} className="brandForm">
            <div className="makeFlex row gap16">
              <div className="flexOne">
                <FormField
                  type="text"
                  name="pincode"
                  label="Pincode (6 digits)"
                  value={mappingFormData.pincode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setMappingFormData({ ...mappingFormData, pincode: value })
                  }}
                  required={true}
                  maxLength={6}
                  placeholder="123456"
                  disabled={!!editingMappingId}
                />
              </div>
              <div className="flexOne">
                <FormField
                  type="select"
                  name="zone"
                  label="Zone"
                  value={mappingFormData.zone}
                  onChange={(e) => setMappingFormData({ ...mappingFormData, zone: e.target.value })}
                  required={true}
                  options={[
                    { value: "", label: "Select Zone" },
                    ...activeZones.map(z => ({ value: z._id, label: z.name }))
                  ]}
                />
              </div>
            </div>

            <div className="makeFlex row gap16">
              <div className="flexOne">
                <FormField
                  type="text"
                  name="state"
                  label="State"
                  value={mappingFormData.state}
                  onChange={(e) => setMappingFormData({ ...mappingFormData, state: e.target.value })}
                  placeholder="Maharashtra"
                />
              </div>
              <div className="flexOne">
                <FormField
                  type="text"
                  name="city"
                  label="City"
                  value={mappingFormData.city}
                  onChange={(e) => setMappingFormData({ ...mappingFormData, city: e.target.value })}
                  placeholder="Mumbai"
                />
              </div>
            </div>

            <div className="makeFlex row gap10">
              <div className="makeFlex column flexOne appendBottom16">
                <label className="formLabel appendBottom10">Status:</label>
                <label className="formLabel appendBottom8 makeFlex gap10">
                  <FormField
                    type="checkbox"
                    name="isActive"
                    checked={mappingFormData.isActive}
                    onChange={(e) => setMappingFormData({ ...mappingFormData, isActive: e.target.checked })}
                  />
                  Active
                </label>
                <p className="negativeMarginTop10">Check this box to keep the mapping active, uncheck to mark as inactive</p>
              </div>
            </div>

            <div className="formActions paddingTop16">
              <button type="submit" className="btnPrimary" disabled={loading}>
                {loading ? 'Saving...' : editingMappingId ? 'Update Mapping' : 'Create Mapping'}
              </button>
              {editingMappingId && (
                <button type="button" onClick={() => resetForm('mapping')} className="btnSecondary">
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      {/* List Containers */}
      {/* Zones Tab List */}
      {activeTab === 'zones' && (
        <div className="brandsListContainer paddingAll32">
            <div className="listHeader makeFlex spaceBetween end appendBottom24">
              <div className="leftSection">
                <h2 className="listTitle font30 fontBold blackText appendBottom16">
                  Shipping Zones ({filteredZones.length})
                </h2>
                <StatusFilter
                  statusFilter={statusFilter}
                  onStatusChange={setStatusFilter}
                  counts={calculateStandardStatusCounts(zones)}
                  disabled={loading}
                />
              </div>
              <div className="rightSection makeFlex end gap10">
                <SearchField
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search zones..."
                  disabled={loading}
                  minWidth="250px"
                />
                {loading && <div className="loadingIndicator grayText">Loading...</div>}
                <ViewToggle
                  viewMode={viewMode}
                  onViewChange={handleViewModeChange}
                  disabled={loading}
                />
              </div>
            </div>

            {filteredZones.length === 0 && !loading ? (
              <div className="emptyState textCenter paddingAll60">
                <div className="emptyIcon appendBottom16">📍</div>
                <h3 className="font22 fontSemiBold grayText appendBottom8">No Zones Found</h3>
                <p className="font16 grayText">Start by adding your first shipping zone above</p>
              </div>
            ) : (
              <>
                {viewMode === 'card' && (
                  <div className="brandsGrid">
                    {displayedCards.map((zone) => (
                      <EntityCard
                        key={zone._id}
                        entity={zone}
                        nameField="name"
                        idField="_id"
                        onEdit={() => handleEdit(zone, 'zone')}
                        onDelete={() => handleDelete(zone._id, 'zone', zone.name)}
                        loading={loading}
                        imagePlaceholderColor={generateBrandColor(zone._id, zone.name)}
                        renderHeader={(zone) => (
                          <EntityCardHeader
                            entity={zone}
                            titleField="name"
                            dateField="createdAt"
                            generateColor={generateBrandColor}
                          />
                        )}
                        renderDetails={(zone) => (
                          <>
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Zone:</span>
                              <span className="detailValue font14 blackText appendLeft6">{zone.name}</span>
                            </div>
                            {zone.description && (
                              <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                                <span className="detailLabel font14 fontSemiBold grayText textUppercase">Description:</span>
                                <span className="detailValue font14 blackText appendLeft6">{zone.description}</span>
                              </div>
                            )}
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                              <span className={`detailValue font14 ${zone.deleted ? 'deleted' : (zone.isActive ? 'greenText' : 'inactive')} appendLeft6`}>
                                {zone.deleted ? 'Deleted' : (zone.isActive ? 'Active' : 'Inactive')}
                              </span>
                            </div>
                          </>
                        )}
                        renderActions={(zone) => (
                          <ActionButtons
                            onEdit={zone.deleted ? undefined : () => handleEdit(zone, 'zone')}
                            onDelete={() => handleDelete(zone._id, 'zone', zone.name)}
                            loading={loading}
                            size="normal"
                            editText="✏️ Edit"
                            deleteText={zone.deleted ? "🗑️ Final Del" : "🗑️ Delete"}
                            editTitle="Edit Zone"
                            deleteTitle={zone.deleted ? "Final Delete" : "Delete Zone"}
                            editDisabled={zone.deleted}
                          />
                        )}
                      />
                    ))}
                    {hasMoreCards && (
                      <div className="loadMoreContainer textCenter paddingAll20">
                        <button
                          onClick={handleLoadMoreCards}
                          className="btnPrimary"
                          disabled={loading}
                        >
                          {loading ? '⏳' : 'Load More'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {viewMode === 'list' && (
                  <div className="brandsListTable">
                    <div className="tableContainer">
                      <table className="brandsTable">
                        <thead>
                          <tr>
                            <th className="tableHeader">Zone Name</th>
                            <th className="tableHeader">Description</th>
                            <th className="tableHeader">Status</th>
                            <th className="tableHeader">Created</th>
                            <th className="tableHeader">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentZones.map((zone) => (
                            <tr key={zone._id} className="tableRow">
                              <td className="tableCell width20 font14 blackText fontSemiBold">{zone.name}</td>
                              <td className="tableCell width40 font14 blackText">{zone.description || '-'}</td>
                              <td className="tableCell width10 font14 blackText">
                                <span className={`statusText ${zone.deleted ? 'deleted' : (zone.isActive ? 'active' : 'inactive')}`}>
                                  {zone.deleted ? 'Deleted' : (zone.isActive ? 'Active' : 'Inactive')}
                                </span>
                              </td>
                              <td className="tableCell width15 font14 blackText">{new Date(zone.createdAt).toLocaleDateString()}</td>
                              <td className="tableCell width15">
                                <div className="tableActions makeFlex gap8">
                                  <ActionButtons
                                    onEdit={zone.deleted ? undefined : () => handleEdit(zone, 'zone')}
                                    onDelete={() => handleDelete(zone._id, 'zone', zone.name)}
                                    loading={loading}
                                    size="small"
                                    editText="✏️"
                                    deleteText={zone.deleted ? "🗑️" : "🗑️"}
                                    editTitle="Edit Zone"
                                    deleteTitle={zone.deleted ? "Final Delete" : "Delete Zone"}
                                    editDisabled={zone.deleted}
                                  />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalPagesZones > 1 && (
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPagesZones}
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
      )}

      {/* Rates Tab List */}
      {activeTab === 'rates' && (
        <div className="brandsListContainer paddingAll32">
            <div className="listHeader makeFlex spaceBetween end appendBottom24">
              <div className="leftSection">
                <h2 className="listTitle font30 fontBold blackText appendBottom16">
                  Shipping Rates ({filteredRates.length})
                </h2>
                <StatusFilter
                  statusFilter={statusFilter}
                  onStatusChange={setStatusFilter}
                  counts={calculateStandardStatusCounts(rates)}
                  disabled={loading}
                />
              </div>
              <div className="rightSection makeFlex end gap10">
                <SearchField
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search rates..."
                  disabled={loading}
                  minWidth="250px"
                />
                {loading && <div className="loadingIndicator grayText">Loading...</div>}
                <ViewToggle
                  viewMode={viewMode}
                  onViewChange={handleViewModeChange}
                  disabled={loading}
                />
              </div>
            </div>

            {filteredRates.length === 0 && !loading ? (
              <div className="emptyState textCenter paddingAll60">
                <div className="emptyIcon appendBottom16">💰</div>
                <h3 className="font22 fontSemiBold grayText appendBottom8">No Rates Found</h3>
                <p className="font16 grayText">Start by adding your first shipping rate above</p>
              </div>
            ) : (
              <>
                {viewMode === 'card' && (
                  <div className="brandsGrid">
                    {filteredRates.slice(0, 16).map((rate) => (
                      <EntityCard
                        key={rate._id}
                        entity={rate}
                        nameField="zone"
                        idField="_id"
                        onEdit={() => handleEdit(rate, 'rate')}
                        onDelete={() => handleDelete(rate._id, 'rate', `${rate.zone?.name} (${rate.minWeight}-${rate.maxWeight}g)`)}
                        loading={loading}
                        imagePlaceholderColor={generateBrandColor(rate._id, rate.zone?.name || 'Rate')}
                        renderHeader={(rate) => (
                          <EntityCardHeader
                            entity={{ name: `${rate.zone?.name || 'N/A'} - ${rate.minWeight}g-${rate.maxWeight}g` }}
                            titleField="name"
                            dateField="createdAt"
                            generateColor={generateBrandColor}
                          />
                        )}
                        renderDetails={(rate) => (
                          <>
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Zone:</span>
                              <span className="detailValue font14 blackText appendLeft6">{rate.zone?.name || 'N/A'}</span>
                            </div>
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Weight Range:</span>
                              <span className="detailValue font14 blackText appendLeft6">{rate.minWeight}g - {rate.maxWeight}g</span>
                            </div>
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Base Rate:</span>
                              <span className="detailValue font14 blackText appendLeft6">₹{rate.rate}</span>
                            </div>
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Additional:</span>
                              <span className="detailValue font14 blackText appendLeft6">{rate.additionalWeight}g = ₹{rate.additionalRate}</span>
                            </div>
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                              <span className={`detailValue font14 ${rate.deleted ? 'deleted' : (rate.isActive ? 'greenText' : 'inactive')} appendLeft6`}>
                                {rate.deleted ? 'Deleted' : (rate.isActive ? 'Active' : 'Inactive')}
                              </span>
                            </div>
                          </>
                        )}
                        renderActions={(rate) => (
                          <ActionButtons
                            onEdit={rate.deleted ? undefined : () => handleEdit(rate, 'rate')}
                            onDelete={() => handleDelete(rate._id, 'rate', `${rate.zone?.name} (${rate.minWeight}-${rate.maxWeight}g)`)}
                            loading={loading}
                            size="normal"
                            editText="✏️ Edit"
                            deleteText={rate.deleted ? "🗑️ Final Del" : "🗑️ Delete"}
                            editTitle="Edit Rate"
                            deleteTitle={rate.deleted ? "Final Delete" : "Delete Rate"}
                            editDisabled={rate.deleted}
                          />
                        )}
                      />
                    ))}
                  </div>
                )}

                {viewMode === 'list' && (
                  <div className="brandsListTable">
                    <div className="tableContainer">
                      <table className="brandsTable">
                        <thead>
                          <tr>
                            <th className="tableHeader">Zone</th>
                            <th className="tableHeader">Weight Range</th>
                            <th className="tableHeader">Base Rate</th>
                            <th className="tableHeader">Additional Slab</th>
                            <th className="tableHeader">Additional Rate</th>
                            <th className="tableHeader">Status</th>
                            <th className="tableHeader">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentRates.map((rate) => (
                            <tr key={rate._id} className="tableRow">
                              <td className="tableCell width15 font14 blackText fontSemiBold">{rate.zone?.name || 'N/A'}</td>
                              <td className="tableCell width15 font14 blackText">{rate.minWeight}g - {rate.maxWeight}g</td>
                              <td className="tableCell width10 font14 blackText">₹{rate.rate}</td>
                              <td className="tableCell width15 font14 blackText">{rate.additionalWeight}g</td>
                              <td className="tableCell width10 font14 blackText">₹{rate.additionalRate}</td>
                              <td className="tableCell width10 font14 blackText">
                                <span className={`statusText ${rate.deleted ? 'deleted' : (rate.isActive ? 'active' : 'inactive')}`}>
                                  {rate.deleted ? 'Deleted' : (rate.isActive ? 'Active' : 'Inactive')}
                                </span>
                              </td>
                              <td className="tableCell width15">
                                <div className="tableActions makeFlex gap8">
                                  <ActionButtons
                                    onEdit={rate.deleted ? undefined : () => handleEdit(rate, 'rate')}
                                    onDelete={() => handleDelete(rate._id, 'rate', `${rate.zone?.name} (${rate.minWeight}-${rate.maxWeight}g)`)}
                                    loading={loading}
                                    size="small"
                                    editText="✏️"
                                    deleteText={rate.deleted ? "🗑️" : "🗑️"}
                                    editTitle="Edit Rate"
                                    deleteTitle={rate.deleted ? "Final Delete" : "Delete Rate"}
                                    editDisabled={rate.deleted}
                                  />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalPagesRates > 1 && (
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPagesRates}
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
      )}

      {/* Mappings Tab List */}
      {activeTab === 'mappings' && (
        <div className="brandsListContainer paddingAll32">
            <div className="listHeader makeFlex spaceBetween end appendBottom24">
              <div className="leftSection">
                <h2 className="listTitle font30 fontBold blackText appendBottom16">
                  Pincode Mappings ({filteredMappings.length})
                </h2>
                <StatusFilter
                  statusFilter={statusFilter}
                  onStatusChange={setStatusFilter}
                  counts={calculateStandardStatusCounts(mappings)}
                  disabled={loading}
                />
              </div>
              <div className="rightSection makeFlex end gap10">
                <SearchField
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search pincodes..."
                  disabled={loading}
                  minWidth="250px"
                />
                {loading && <div className="loadingIndicator grayText">Loading...</div>}
                <ViewToggle
                  viewMode={viewMode}
                  onViewChange={handleViewModeChange}
                  disabled={loading}
                />
              </div>
            </div>

            {filteredMappings.length === 0 && !loading ? (
              <div className="emptyState textCenter paddingAll60">
                <div className="emptyIcon appendBottom16">🗺️</div>
                <h3 className="font22 fontSemiBold grayText appendBottom8">No Mappings Found</h3>
                <p className="font16 grayText">Start by adding your first pincode mapping above</p>
              </div>
            ) : (
              <>
                {viewMode === 'card' && (
                  <div className="brandsGrid">
                    {filteredMappings.slice(0, 16).map((mapping) => (
                      <EntityCard
                        key={mapping._id}
                        entity={mapping}
                        nameField="pincode"
                        idField="_id"
                        onEdit={() => handleEdit(mapping, 'mapping')}
                        onDelete={() => handleDelete(mapping._id, 'mapping', `Pincode ${mapping.pincode}`)}
                        loading={loading}
                        imagePlaceholderColor={generateBrandColor(mapping._id, mapping.pincode)}
                        renderHeader={(mapping) => (
                          <EntityCardHeader
                            entity={{ name: `Pincode: ${mapping.pincode}` }}
                            titleField="name"
                            dateField="createdAt"
                            generateColor={generateBrandColor}
                          />
                        )}
                        renderDetails={(mapping) => (
                          <>
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Pincode:</span>
                              <span className="detailValue font14 blackText appendLeft6">{mapping.pincode}</span>
                            </div>
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Zone:</span>
                              <span className="detailValue font14 blackText appendLeft6">{mapping.zone?.name || 'N/A'}</span>
                            </div>
                            {mapping.state && (
                              <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                                <span className="detailLabel font14 fontSemiBold grayText textUppercase">State:</span>
                                <span className="detailValue font14 blackText appendLeft6">{mapping.state}</span>
                              </div>
                            )}
                            {mapping.city && (
                              <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                                <span className="detailLabel font14 fontSemiBold grayText textUppercase">City:</span>
                                <span className="detailValue font14 blackText appendLeft6">{mapping.city}</span>
                              </div>
                            )}
                            <div className="brandDetail makeFlex spaceBetween alignCenter paddingTop8 paddingBottom8">
                              <span className="detailLabel font14 fontSemiBold grayText textUppercase">Status:</span>
                              <span className={`detailValue font14 ${mapping.deleted ? 'deleted' : (mapping.isActive ? 'greenText' : 'inactive')} appendLeft6`}>
                                {mapping.deleted ? 'Deleted' : (mapping.isActive ? 'Active' : 'Inactive')}
                              </span>
                            </div>
                          </>
                        )}
                        renderActions={(mapping) => (
                          <ActionButtons
                            onEdit={mapping.deleted ? undefined : () => handleEdit(mapping, 'mapping')}
                            onDelete={() => handleDelete(mapping._id, 'mapping', `Pincode ${mapping.pincode}`)}
                            loading={loading}
                            size="normal"
                            editText="✏️ Edit"
                            deleteText={mapping.deleted ? "🗑️ Final Del" : "🗑️ Delete"}
                            editTitle="Edit Mapping"
                            deleteTitle={mapping.deleted ? "Final Delete" : "Delete Mapping"}
                            editDisabled={mapping.deleted}
                          />
                        )}
                      />
                    ))}
                  </div>
                )}

                {viewMode === 'list' && (
                  <div className="brandsListTable">
                    <div className="tableContainer">
                      <table className="brandsTable">
                        <thead>
                          <tr>
                            <th className="tableHeader">Pincode</th>
                            <th className="tableHeader">Zone</th>
                            <th className="tableHeader">State</th>
                            <th className="tableHeader">City</th>
                            <th className="tableHeader">Status</th>
                            <th className="tableHeader">Created</th>
                            <th className="tableHeader">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentMappings.map((mapping) => (
                            <tr key={mapping._id} className="tableRow">
                              <td className="tableCell width10 font14 blackText fontSemiBold">{mapping.pincode}</td>
                              <td className="tableCell width20 font14 blackText">{mapping.zone?.name || 'N/A'}</td>
                              <td className="tableCell width20 font14 blackText">{mapping.state || '-'}</td>
                              <td className="tableCell width20 font14 blackText">{mapping.city || '-'}</td>
                              <td className="tableCell width10 font14 blackText">
                                <span className={`statusText ${mapping.deleted ? 'deleted' : (mapping.isActive ? 'active' : 'inactive')}`}>
                                  {mapping.deleted ? 'Deleted' : (mapping.isActive ? 'Active' : 'Inactive')}
                                </span>
                              </td>
                              <td className="tableCell width10 font14 blackText">{new Date(mapping.createdAt).toLocaleDateString()}</td>
                              <td className="tableCell width10">
                                <div className="tableActions makeFlex gap8">
                                  <ActionButtons
                                    onEdit={mapping.deleted ? undefined : () => handleEdit(mapping, 'mapping')}
                                    onDelete={() => handleDelete(mapping._id, 'mapping', `Pincode ${mapping.pincode}`)}
                                    loading={loading}
                                    size="small"
                                    editText="✏️"
                                    deleteText={mapping.deleted ? "🗑️" : "🗑️"}
                                    editTitle="Edit Mapping"
                                    deleteTitle={mapping.deleted ? "Final Delete" : "Delete Mapping"}
                                    editDisabled={mapping.deleted}
                                  />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalPagesMappings > 1 && (
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPagesMappings}
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
      )}

      <DeleteConfirmationPopup
        isVisible={deletePopup.isVisible}
        message={deletePopup.message}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        action="delete"
      />
    </div>
  )
}

export default ShippingCostManager
