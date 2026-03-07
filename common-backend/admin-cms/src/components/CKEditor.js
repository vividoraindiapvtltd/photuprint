import React, { useEffect, useRef, useState } from "react"
import Quill from "quill"
import "quill/dist/quill.snow.css"
import DOMPurify from "dompurify"

const RichTextEditor = ({ value, onChange, name, label, placeholder, required, disabled }) => {
  const editorRef = useRef(null)
  const quillInstanceRef = useRef(null)
  const containerRef = useRef(null) // Store container so cleanup can clear it fully (toolbar + editor)
  const isInitializingRef = useRef(false)
  const [isReady, setIsReady] = useState(false)
  const isInternalChangeRef = useRef(false)
  const onChangeRef = useRef(onChange)
  const nameRef = useRef(name)

  // Keep refs updated without triggering re-initialization
  useEffect(() => {
    onChangeRef.current = onChange
    nameRef.current = name
  }, [onChange, name])

  // Initialize Quill editor - only once per container
  useEffect(() => {
    const container = editorRef.current
    if (!container) return

    // Prevent multiple initializations
    if (quillInstanceRef.current || isInitializingRef.current) return

    // Skip if container already has Quill content (toolbar or editor) - avoid double init
    if (container.querySelector(".ql-toolbar") || container.querySelector(".ql-container")) {
      return
    }

    isInitializingRef.current = true
    containerRef.current = container
    container.innerHTML = ""

    // Toolbar: avoid font/size if not registered in this Quill build; "list" covers ordered + bullet (no separate "bullet" format)
    const quill = new Quill(container, {
      theme: "snow",
      placeholder: placeholder || "Enter product description...",
      readOnly: disabled,
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, 4, 5, 6, false] }],
          ["bold", "italic", "underline", "strike", "blockquote"],
          [{ list: "ordered" }, { list: "bullet" }, { indent: "-1" }, { indent: "+1" }],
          ["link", "image"],
          [{ color: [] }, { background: [] }],
          ["clean"],
        ],
      },
      // Only formats that exist in Quill – "bullet" is not a format name (list attribute is "bullet"/"ordered")
    })

    quillInstanceRef.current = quill
    isInitializingRef.current = false
    setIsReady(true)

    // Patch Quill's getSelection to always return a valid range
    const originalGetSelection = quill.getSelection.bind(quill)
    quill.getSelection = function (focus = false) {
      try {
        const selection = originalGetSelection(focus)
        if (!selection) {
          // If no selection, create one at the end of the document
          const length = this.getLength()
          if (length > 1) {
            const endIndex = length - 1
            return { index: endIndex, length: 0 }
          } else if (length > 0) {
            return { index: 0, length: 0 }
          } else {
            // Empty document - ensure we have content
            this.setText("\n")
            return { index: 0, length: 0 }
          }
        }
        // Validate selection has valid index
        if (selection.index === null || selection.index === undefined) {
          const length = this.getLength()
          if (length > 1) {
            return { index: length - 1, length: 0 }
          }
          return { index: 0, length: 0 }
        }
        return selection
      } catch (e) {
        // Fallback: return a safe selection
        const length = this.getLength()
        return { index: length > 1 ? length - 1 : 0, length: 0 }
      }
    }

    // Patch Quill's getFormat to handle null selections gracefully
    const originalGetFormat = quill.getFormat.bind(quill)
    quill.getFormat = function (range = null) {
      try {
        if (range === null) {
          range = this.getSelection(true)
        }
        if (!range || range.index === null || range.index === undefined) {
          // Return empty format object if no valid selection
          return {}
        }
        return originalGetFormat(range)
      } catch (e) {
        // Return empty format object on error
        return {}
      }
    }

    // Ensure editor has focus and selection when interacting with toolbar
    const toolbar = containerRef.current?.querySelector(".ql-toolbar")
    if (toolbar) {
      // Use mousedown (fires before click) to ensure selection exists
      toolbar.addEventListener(
        "mousedown",
        (e) => {
          // If clicking a toolbar button or picker, ensure editor has focus and selection
          if (e.target.closest("button") || e.target.closest(".ql-picker")) {
            // Ensure editor has focus first (synchronously)
            if (!quill.hasFocus()) {
              quill.focus()
            }

            // Set selection synchronously before Quill's handlers run
            const selection = quill.getSelection(true)
            if (!selection || selection.index === null || selection.index === undefined) {
              const length = quill.getLength()
              if (length > 1) {
                quill.setSelection(length - 1, 0)
              } else if (length > 0) {
                quill.setSelection(0, 0)
              } else {
                // Empty document - add content and set selection
                quill.setText("\n")
                quill.setSelection(0, 0)
              }
            }
          }
        },
        true
      ) // Use capture phase to run before Quill's handlers
    }

    // Handle text changes
    const handleTextChange = () => {
      isInternalChangeRef.current = true
      const htmlContent = quill.root.innerHTML
      const sanitizedData = DOMPurify.sanitize(htmlContent)

      if (onChangeRef.current) {
        const syntheticEvent = {
          target: {
            name: nameRef.current,
            value: sanitizedData,
          },
        }
        onChangeRef.current(syntheticEvent)
      }
    }

    quill.on("text-change", handleTextChange)

    // Handle selection changes to ensure we always have a valid selection
    const handleSelectionChange = (range) => {
      // If selection is lost, restore it to end of document
      if (!range && quill.hasFocus()) {
        try {
          const length = quill.getLength()
          if (length > 1) {
            quill.setSelection(length - 1, 0)
          }
        } catch (e) {
          // Ignore errors
        }
      }
    }

    quill.on("selection-change", handleSelectionChange)

    // Cleanup: clear the full container (toolbar + editor) so React Strict Mode remount doesn't show double toolbar
    return () => {
      if (quillInstanceRef.current) {
        try {
          quillInstanceRef.current.off("text-change", handleTextChange)
          quillInstanceRef.current.off("selection-change", handleSelectionChange)
        } catch (e) {
          // Ignore errors during cleanup
        }
        quillInstanceRef.current = null
      }
      // Clear the entire container so both .ql-toolbar and .ql-container are removed (fixes double toolbar on remount)
      const container = containerRef.current
      if (container) {
        container.innerHTML = ""
        containerRef.current = null
      }
      isInitializingRef.current = false
      setIsReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty dependency array - only initialize once

  // Update editor content when value prop changes externally
  useEffect(() => {
    if (!isReady || !quillInstanceRef.current) return

    // Only update if this is an external change (not from user typing)
    if (!isInternalChangeRef.current) {
      const sanitizedValue = value ? DOMPurify.sanitize(value) : ""
      const currentContent = quillInstanceRef.current.root.innerHTML

      // Only update if content is different to avoid unnecessary updates
      if (sanitizedValue !== currentContent) {
        // Save current selection
        const selection = quillInstanceRef.current.getSelection(true)

        // Update content
        quillInstanceRef.current.root.innerHTML = sanitizedValue

        // Restore or set selection after update
        try {
          const length = quillInstanceRef.current.getLength()
          if (selection && selection.index < length) {
            quillInstanceRef.current.setSelection(selection.index, selection.length || 0)
          } else if (length > 1) {
            // Set selection to end of document
            quillInstanceRef.current.setSelection(length - 1, 0)
          }
        } catch (e) {
          // If selection fails, just set to end
          try {
            const length = quillInstanceRef.current.getLength()
            if (length > 1) {
              quillInstanceRef.current.setSelection(length - 1, 0)
            }
          } catch (e2) {
            // Ignore errors
          }
        }
      }
    }

    // Reset the flag after processing
    isInternalChangeRef.current = false
  }, [value, isReady])

  // Update readOnly state
  useEffect(() => {
    if (quillInstanceRef.current) {
      quillInstanceRef.current.enable(!disabled)
    }
  }, [disabled])

  return (
    <div style={{ marginBottom: "15px" }}>
      {label && (
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", fontSize: "14px", color: "#333" }}>
          {label}
          {required && <span style={{ color: "red", marginLeft: "4px" }}>*</span>}
        </label>
      )}
      <div
        style={{
          width: "100%",
          border: "1px solid #ddd",
          borderRadius: "4px",
          backgroundColor: "white",
          minHeight: "200px",
        }}
      >
        <div ref={editorRef} style={{ minHeight: "200px", width: "100%" }} />
      </div>
    </div>
  )
}

export default RichTextEditor
