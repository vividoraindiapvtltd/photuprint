"use client"

import { useState, useEffect } from "react"
import api from "../utils/api"
import TemplateEditor from "./TemplateEditor"

/**
 * TemplateRenderer - Fetches and displays templates for a category
 * Includes TemplateEditor for canvas-based customization
 * 
 * Props:
 * - categoryId: Category ID to fetch templates for
 * - onTemplateSelect: Callback when a template is selected
 * - onDesignSave: Callback when user saves a design from the editor
 */
export default function TemplateRenderer({ categoryId, onTemplateSelect, onDesignSave }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [showEditor, setShowEditor] = useState(false)

  useEffect(() => {
    if (categoryId) {
      fetchTemplates()
    } else {
      setTemplates([])
      setSelectedTemplate(null)
      setShowEditor(false)
    }
  }, [categoryId])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      setError("")
      const response = await api.get(`/templates/category/${categoryId}?isActive=true`)
      setTemplates(response.data || [])

      // Auto-select first template if available
      if (response.data?.length > 0) {
        const firstTemplate = response.data[0]
        setSelectedTemplate(firstTemplate)
        if (onTemplateSelect) {
          onTemplateSelect(firstTemplate)
        }
      }
    } catch (err) {
      console.error("Error fetching templates:", err)
      setError("Failed to load templates")
    } finally {
      setLoading(false)
    }
  }

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template)
    setShowEditor(false) // Reset editor when changing template
    if (onTemplateSelect) {
      onTemplateSelect(template)
    }
  }

  const handleEditClick = () => {
    if (selectedTemplate) {
      setShowEditor(true)
    }
  }

  const handleEditorSave = (designData) => {
    console.log("Design saved:", designData)
    if (onDesignSave) {
      onDesignSave(designData)
    }
    // Optionally close editor or show success message
  }

  const handleBackToSelection = () => {
    setShowEditor(false)
  }

  if (!categoryId) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
        <p className="text-yellow-800 text-sm">No category selected. Templates are category-specific.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="inline-flex items-center space-x-2">
          <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-gray-600">Loading templates...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-red-800 text-sm">{error}</p>
        <button
          onClick={fetchTemplates}
          className="mt-2 text-sm text-red-700 underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    )
  }

  if (templates.length === 0) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
        <p className="text-gray-600 text-sm">No templates available for this category.</p>
      </div>
    )
  }

  // Show Editor Mode
  if (showEditor && selectedTemplate) {
    return (
      <div className="space-y-4">
        <button
          onClick={handleBackToSelection}
          className="flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Template Selection
        </button>
        <TemplateEditor template={selectedTemplate} onSave={handleEditorSave} />
      </div>
    )
  }

  // Template Selection Mode
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Select a Template</h3>
        {selectedTemplate && (
          <button
            onClick={handleEditClick}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Edit Template</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => {
          const isSelected = selectedTemplate?._id === template._id || selectedTemplate?.id === template.id
          const previewImg = template.previewImage || template.backgroundImages?.[0]
          
          return (
            <div
              key={template._id || template.id}
              onClick={() => handleTemplateSelect(template)}
              className={`border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                isSelected
                  ? "border-blue-500 ring-2 ring-blue-200 shadow-lg"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md"
              }`}
            >
              {/* Preview Image */}
              <div className="aspect-video bg-gray-100 relative overflow-hidden">
                {previewImg ? (
                  <img
                    src={previewImg.startsWith("http") ? previewImg : `http://localhost:8080${previewImg}`}
                    alt={template.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-gray-400 text-sm">No Preview</span>
                  </div>
                )}
                
                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}

                {/* Template info overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                  <div className="flex items-center space-x-2 text-xs text-white/80">
                    {template.backgroundImages?.length > 0 && (
                      <span className="flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                        </svg>
                        {template.backgroundImages.length} BG
                      </span>
                    )}
                    {template.logoImages?.length > 0 && (
                      <span className="flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                        {template.logoImages.length} Logos
                      </span>
                    )}
                    {template.textOption && (
                      <span className="flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
                        </svg>
                        Text
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Template Info */}
              <div className={`p-3 ${isSelected ? "bg-blue-50" : "bg-white"}`}>
                <h4 className="font-semibold text-gray-800">{template.name}</h4>
                {template.description && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{template.description}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected Template Info */}
      {selectedTemplate && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-blue-900">Selected: {selectedTemplate.name}</h4>
              <p className="text-sm text-blue-700 mt-1">
                {selectedTemplate.backgroundImages?.length || 0} background(s), {selectedTemplate.logoImages?.length || 0} logo(s)
                {selectedTemplate.textOption && ", text enabled"}
              </p>
            </div>
            <button
              onClick={handleEditClick}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
            >
              Customize Design →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
