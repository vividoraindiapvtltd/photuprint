import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import api, { getUploadBaseURL } from "../api/axios"
import { PageHeader, AlertMessage, ViewToggle, Pagination, EntityCard, FormField, SearchField, DeleteConfirmationPopup } from "../common"

const ReviewManager = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [editingId, setEditingId] = useState(null)

  // Dropdown data
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [products, setProducts] = useState([])

  const initialFormData = {
    categoryId: "",
    subCategoryId: "",
    productId: "",
    productName: "",
    userId: "",
    name: "",
    avatar: null,
    title: "",
    email: "",
    comment: "",
    rating: 0,
    productImage: null, // Keep for backward compatibility
    productImages: [], // Array of product images (up to 6)
    status: "approved", // Admin-created reviews are auto-approved
    source: "admin", // Admin-created reviews
  }

  const [formData, setFormData] = useState(initialFormData)
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(null)
  const [currentProductImageUrls, setCurrentProductImageUrls] = useState([]) // Array of product image URLs
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  
  // Initialize filters from URL params
  const statusFromUrl = searchParams.get('status') || 'all';
  const sourceFromUrl = searchParams.get('source') || 'all';
  const filterFromUrl = searchParams.get('filter'); // 'today', 'weekly', 'monthly'
  
  const [statusFilter, setStatusFilter] = useState(statusFromUrl) // 'all', 'pending', 'approved', 'rejected'
  const [sourceFilter, setSourceFilter] = useState(sourceFromUrl) // 'all', 'admin', 'user'
  const [ratingFilter, setRatingFilter] = useState("all") // 'all', '1', '2', '3', '4', '5'

  // Helper to force browsers to load the latest image after updates
  const addCacheBuster = (url, cacheBuster) => {
    if (!url) return url;
    // Avoid duplicating the cache-buster if it's already present
    if (url.includes('v=')) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${cacheBuster}`;
  };

  // Image popup state
  const [imagePopup, setImagePopup] = useState({
    isVisible: false,
    imageUrl: null
  })

  // Delete confirmation popup state
  const [deletePopup, setDeletePopup] = useState({
    isVisible: false,
    reviewId: null,
    message: "",
    isPermanentDelete: false,
    action: "delete",
  })

  // Status update popup state
  const [statusUpdatePopup, setStatusUpdatePopup] = useState({
    isVisible: false,
    reviewId: null,
    newStatus: null,
    title: "",
    message: "",
  })

  // Refs
  const formRef = useRef(null)
  const nameInputRef = useRef(null)
  const avatarInputRef = useRef(null)
  const productImageInputRef = useRef(null)
  // Ref to track product images to avoid stale closure issues
  const productImagesRef = useRef([])

  // View mode and pagination states
  const [viewMode, setViewMode] = useState("card")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [hasMoreCards, setHasMoreCards] = useState(true)
  const [displayedCards, setDisplayedCards] = useState([])

  // Fetch dropdown data
  const fetchDropdownData = async () => {
    try {
      const [categoriesRes] = await Promise.all([api.get("/categories?showInactive=true&includeDeleted=true")])
      setCategories(categoriesRes.data || [])
    } catch (err) {
      console.error("Error fetching dropdown data:", err)
    }
  }

  // Fetch subcategories when category changes
  const fetchSubcategories = async (categoryId) => {
    if (!categoryId) {
      setSubcategories([])
      setProducts([]) // Clear products when category is cleared
      return
    }
    try {
      const response = await api.get(`/subcategories?categoryId=${categoryId}&showInactive=true&includeDeleted=true`)
      setSubcategories(response.data || [])
    } catch (err) {
      console.error("Error fetching subcategories:", err)
      setSubcategories([])
    }
  }

  // Fetch products when subcategory changes (based on subcategory only)
  const fetchProducts = async (subCategoryId) => {
    if (!subCategoryId) {
      setProducts([])
      return
    }
    try {
      const response = await api.get(`/products?subCategoryId=${subCategoryId}&showInactive=true&includeDeleted=true&limit=1000`)
      const productsData = response.data.products || response.data || []
      setProducts(Array.isArray(productsData) ? productsData : [])
    } catch (err) {
      console.error("Error fetching products:", err)
      setProducts([])
    }
  }

  // Validate image dimensions (max 1200x1200px)
  const validateImageDimensions = (file) => {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve({ isValid: true, error: "" });
        return;
      }

      // Check if it's an image file
      if (!file.type.startsWith('image/')) {
        resolve({ isValid: false, error: "Please select a valid image file" });
        return;
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const maxDimension = 1200;
        
        if (img.width > maxDimension || img.height > maxDimension) {
          resolve({ 
            isValid: false, 
            error: `Image dimensions (${img.width}x${img.height}px) exceed the maximum allowed size of ${maxDimension}x${maxDimension}px. Please resize your image.` 
          });
        } else {
          resolve({ isValid: true, error: "" });
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ isValid: false, error: "Failed to load image. Please select a valid image file." });
      };

      img.src = objectUrl;
    });
  };

  // Normalize image URL: full URLs (Cloudinary etc.) as-is, relative paths → full URL using API host
  const normalizeImageUrl = (imageUrl) => {
    if (imageUrl == null || (typeof imageUrl === "string" && !imageUrl.trim())) return null;
    const url = typeof imageUrl === "string" ? imageUrl.trim() : String(imageUrl);
    const base = getUploadBaseURL();

    if (url.startsWith("http://") || url.startsWith("https://")) {
      if (url.includes("/backend/uploads/") || url.includes("/Users/")) {
        const filename = url.split("/").pop() || "";
        return `${base}/uploads/${filename}`;
      }
      return url;
    }
    if (url.includes("/backend/uploads/") || url.includes("/Users/")) {
      const filename = url.split("/").pop() || "";
      return `${base}/uploads/${filename}`;
    }
    if (url.startsWith("/uploads/") || url.startsWith("/")) {
      return `${base}${url}`;
    }
    return `${base}/uploads/${url}`;
  };

  // Handle form changes
  const handleChange = async (e) => {
    const { name, value, type, checked, files } = e.target

    if (type === "checkbox") {
      setFormData((prev) => ({ ...prev, [name]: checked }))
    } else if (type === "file") {
      // Handle multiple files for productImages
      if (name === "productImages" && files.length > 0) {
        const maxImages = 6;
        const selectedFiles = Array.from(files);
        
        // Clear the input immediately to prevent duplicate triggers
        e.target.value = '';
        
        // Validate all selected images first
        for (const file of selectedFiles) {
          if (file.type.startsWith('image/')) {
            const validation = await validateImageDimensions(file);
            if (!validation.isValid) {
              setError(`${file.name}: ${validation.error}`);
              return;
            }
          }
        }
        
        // Check total count (existing + new)
        // IMPORTANT: Use functional update to ensure we have the latest state
        // NOTE: Avatar is NOT counted - only productImages are counted
        setFormData((prev) => {
          // CRITICAL: Always preserve existing images when adding new ones
          // Priority: 1) prev.productImages (state), 2) ref (if state is empty), 3) empty array
          let currentProductImages = prev.productImages || [];
          
          // SAFEGUARD: If state is empty but we're editing and have URLs in ref, use ref
          // This handles edge cases where state might not be synced yet
          if (currentProductImages.length === 0 && editingId && productImagesRef.current.length > 0) {
            console.warn('⚠️ State is empty but ref has images, using ref as fallback');
            currentProductImages = [...productImagesRef.current]; // Create a copy to avoid mutations
          }
          
          // CRITICAL: Log what we're working with
          if (editingId && currentProductImages.length === 0) {
            console.error('❌ CRITICAL: Editing review but no images found in state or ref! This will cause data loss.');
          }
          
          console.log('🔍 Current productImages state:', {
            count: currentProductImages.length,
            types: currentProductImages.map(img => typeof img === 'string' ? 'URL' : img instanceof File ? 'File' : 'Unknown'),
            refCount: productImagesRef.current.length,
            stateCount: prev.productImages?.length || 0,
            editingId: !!editingId
          });
          
          // Ensure we're only counting productImages, not avatar
          // Avatar is stored separately in prev.avatar and is NOT included here
          // CRITICAL: Filter existing URLs (strings) - these are the OLD images we MUST preserve
          // When editing, we MUST preserve ALL URLs from the database
          let existingUrls = currentProductImages.filter(img => typeof img === 'string' && img.trim() !== ''); // Existing URLs from server
          
          // EXTRA SAFEGUARD: If editing and we have URLs in ref but not in currentProductImages, add them
          // This ensures we NEVER lose original URLs
          if (editingId && existingUrls.length === 0 && productImagesRef.current.length > 0) {
            const urlsFromRef = productImagesRef.current.filter(img => typeof img === 'string' && img.trim() !== '');
            if (urlsFromRef.length > 0) {
              console.warn('⚠️ Found URLs in ref but not in state, preserving from ref:', urlsFromRef.length);
              existingUrls = urlsFromRef;
            }
          }
          
          // Filter existing Files - these are previously selected files (not yet uploaded)
          const existingFiles = currentProductImages.filter(img => img instanceof File); // Previously selected files
          
          console.log('📊 Image breakdown BEFORE adding new files:', {
            existingUrls: existingUrls.length,
            existingFiles: existingFiles.length,
            existingUrlsList: existingUrls.map(url => url.substring(0, 60) + '...'),
            existingFilesList: existingFiles.map(f => `${f.name} (${(f.size / 1024).toFixed(1)}KB)`),
            editingMode: !!editingId,
            warning: editingId && existingUrls.length === 0 ? '⚠️ NO EXISTING URLS FOUND IN EDIT MODE!' : 'OK'
          });
          
          console.log('📊 Image breakdown:', {
            existingUrls: existingUrls.length,
            existingFiles: existingFiles.length,
            existingUrlsList: existingUrls.map(url => url.substring(0, 50) + '...'),
            existingFilesList: existingFiles.map(f => f.name)
          });
          
          // Check for duplicate files by name and size to prevent duplicates
          const existingFileNames = new Set(existingFiles.map(f => `${f.name}-${f.size}`));
          const uniqueNewFiles = selectedFiles.filter(file => {
            const fileKey = `${file.name}-${file.size}`;
            return !existingFileNames.has(fileKey);
          });
          
          if (uniqueNewFiles.length < selectedFiles.length) {
            const duplicateCount = selectedFiles.length - uniqueNewFiles.length;
            setError(`⚠️ ${duplicateCount} duplicate image(s) were skipped.`);
          }
          
          // Count only product images (avatar is separate and not counted)
          const totalExisting = existingUrls.length + existingFiles.length;
          
          console.log('Product images count (before adding):', {
            existingUrls: existingUrls.length,
            existingFiles: existingFiles.length,
            totalExisting,
            selectedFiles: selectedFiles.length,
            uniqueNewFiles: uniqueNewFiles.length,
            avatar: prev.avatar ? 'has avatar (not counted)' : 'no avatar'
          });
          
          // Calculate how many files we can actually add
          const remainingSlots = maxImages - totalExisting;
          
          let filesToAdd;
          let allImages;
          
          if (remainingSlots <= 0 && uniqueNewFiles.length > 0) {
            // User already has 6 but selected new files: replace all with new selection (up to 6)
            filesToAdd = uniqueNewFiles.slice(0, maxImages);
            allImages = filesToAdd;
            setError("");
          } else if (remainingSlots <= 0) {
            // No new files selected and already at max
            setError(`You already have the maximum of ${maxImages} product images. Remove one or more to add new ones.`);
            return prev;
          } else {
            // Normal case: add new files up to remaining slots
            filesToAdd = uniqueNewFiles.slice(0, remainingSlots);
            // Combine existing with new, limit to maxImages
            allImages = [...existingUrls, ...existingFiles, ...filesToAdd].slice(0, maxImages);
            
            const newCount = uniqueNewFiles.length;
            if (newCount > remainingSlots) {
              setError(`Only ${filesToAdd.length} of ${newCount} image(s) added (maximum ${maxImages} total).`);
            } else {
              setError("");
            }
          }
          
          console.log('✅ Adding images - Final state:', {
            existingUrls: existingUrls.length,
            existingFiles: existingFiles.length,
            filesToAdd: filesToAdd.length,
            allImages: allImages.length,
            maxImages,
            breakdown: {
              urlsInFinal: allImages.filter(img => typeof img === 'string').length,
              filesInFinal: allImages.filter(img => img instanceof File).length
            }
          });
          
          // When adding (not replacing), ensure we didn't lose existing URLs
          if (remainingSlots > 0 && existingUrls.length > 0) {
            const urlsInFinal = allImages.filter(img => typeof img === 'string').length;
            if (urlsInFinal < existingUrls.length) {
              console.error('❌ ERROR: Lost existing URLs!', {
                originalUrls: existingUrls.length,
                urlsInFinal: urlsInFinal,
                allImagesCount: allImages.length
              });
              setError(`⚠️ Error: Cannot preserve all existing images. Please try again.`);
              return prev;
            }
          }
          
          // Rebuild currentProductImageUrls from allImages
          // Use functional update to get the latest currentProductImageUrls state
          setCurrentProductImageUrls((prevUrls) => {
            const existingBlobUrls = prevUrls.filter(url => url.startsWith('blob:'));
            
            const updatedPreviewUrls = allImages.map((img, index) => {
              if (typeof img === 'string') {
                // It's an existing URL from server, normalize it for display
                return normalizeImageUrl(img);
              } else if (img instanceof File) {
                // It's a File object
                // Count how many URLs (non-Files) come before this position
                const urlsBeforeThis = allImages.slice(0, index).filter(i => typeof i === 'string').length;
                // Count how many Files come before this File
                const filesBeforeThis = allImages.slice(0, index).filter(i => i instanceof File).length;
                
                // If this File is in the "existing Files" range (before new files), reuse its blob URL
                if (filesBeforeThis < existingFiles.length) {
                  // This is an existing file - reuse blob URL by position
                  const existingFileIndex = filesBeforeThis;
                  if (existingBlobUrls[existingFileIndex]) {
                    return existingBlobUrls[existingFileIndex];
                  }
                }
                
                // This is a new file, create new blob URL
                return URL.createObjectURL(img);
              }
              return null;
            }).filter(url => url !== null);
            
            console.log('Preview URLs updated:', {
              allImagesCount: allImages.length,
              previewUrlsCount: updatedPreviewUrls.length,
              previewUrls: updatedPreviewUrls.map((url, idx) => `${idx + 1}: ${url.substring(0, 50)}...`)
            });
            
            // Validate that preview URLs match allImages count
            if (updatedPreviewUrls.length !== allImages.length) {
              console.error('Preview URL count mismatch!', {
                allImagesLength: allImages.length,
                previewUrlsLength: updatedPreviewUrls.length
              });
            }
            
            // Revoke blob URLs that are no longer needed (for files that were removed)
            const currentBlobUrls = new Set(updatedPreviewUrls.filter(url => url.startsWith('blob:')));
            existingBlobUrls.forEach(blobUrl => {
              if (!currentBlobUrls.has(blobUrl)) {
                URL.revokeObjectURL(blobUrl);
              }
            });
            
            return updatedPreviewUrls;
          });
          
          const updatedFormData = {
            ...prev,
            productImages: allImages,
            productImage: allImages[0] instanceof File ? allImages[0] : (allImages[0] || prev.productImage)
          };
          
          // Verify arrays are in sync
          console.log('✅ Form data updated:', {
            productImagesCount: updatedFormData.productImages.length,
            productImages: updatedFormData.productImages.map((img, idx) => ({
              index: idx + 1,
              type: typeof img === 'string' ? 'URL' : img instanceof File ? 'File' : 'Unknown',
              value: typeof img === 'string' ? img.substring(0, 50) + '...' : img instanceof File ? img.name : img
            })),
            urlsCount: updatedFormData.productImages.filter(img => typeof img === 'string').length,
            filesCount: updatedFormData.productImages.filter(img => img instanceof File).length
          });
          
          // CRITICAL: Update ref AFTER state update to ensure consistency
          // The ref will be updated in the next render cycle, but we update it here for immediate use
          productImagesRef.current = allImages;
          console.log('✅ Ref updated with allImages:', allImages.length);
          
          return updatedFormData;
        });
        
        // Clear any previous error if validation passes
        if (error && error.includes('dimensions')) {
          setError("");
        }
        return;
      }
      
      // Handle single file uploads (avatar, productImage for backward compatibility)
      if (files[0] && files[0].type.startsWith('image/')) {
        const validation = await validateImageDimensions(files[0]);
        if (!validation.isValid) {
          setError(validation.error);
          e.target.value = '';
          return;
        }
      }
      
      // Use functional update to preserve other fields
      setFormData((prev) => ({ ...prev, [name]: files[0] || null }));
      
      // Update current URL preview if it's an image field
      if (name === "avatar" && files[0]) {
        const objectUrl = URL.createObjectURL(files[0]);
        setCurrentAvatarUrl(objectUrl);
      } else if (name === "productImage" && files[0]) {
        // Single productImage (backward compatibility)
        const objectUrl = URL.createObjectURL(files[0]);
        setCurrentProductImageUrls([objectUrl]);
        setFormData((prev) => ({ 
          ...prev, 
          productImage: files[0],
          productImages: [files[0]] 
        }));
      }
      
      // Clear any previous error if validation passes
      if (error && error.includes('dimensions')) {
        setError("");
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))

      // Auto-fetch subcategories when category changes
      if (name === "categoryId") {
        fetchSubcategories(value)
        // Clear subcategory and product selections when category changes
        setFormData((prev) => ({ ...prev, subCategoryId: "", productId: "", productName: "" }))
        setProducts([]) // Clear products when category changes
      }

      // Auto-fetch products when subcategory changes (based on subcategory only)
      if (name === "subCategoryId") {
        if (value) {
          fetchProducts(value)
        } else {
          setProducts([])
        }
        // Clear product selection when subcategory changes
        setFormData((prev) => ({ ...prev, productId: "", productName: "" }))
      }

      // Auto-set product name when product is selected
      if (name === "productId") {
        const selectedProduct = products.find((p) => p._id === value || p.id === value)
        setFormData((prev) => ({
          ...prev,
          productName: selectedProduct?.name || "",
        }))
      }
    }
  }

  // Handle rating change
  const handleRatingChange = (rating) => {
    setFormData((prev) => ({ ...prev, rating }))
  }

  // Sync currentProductImageUrls with formData.productImages
  // This ensures the display stays in sync even if there are timing issues
  useEffect(() => {
    if (formData.productImages && formData.productImages.length > 0) {
      // Create a map to track which files already have blob URLs
      const fileToBlobUrlMap = new Map();
      currentProductImageUrls.forEach((url, idx) => {
        if (url.startsWith('blob:') && formData.productImages[idx] instanceof File) {
          fileToBlobUrlMap.set(formData.productImages[idx], url);
        }
      });
      
      const expectedUrls = formData.productImages.map((img) => {
        if (typeof img === 'string') {
          // Normalize URL for display (but keep original in formData for backend)
          return normalizeImageUrl(img);
        } else if (img instanceof File) {
          // Check if we already have a blob URL for this file
          if (fileToBlobUrlMap.has(img)) {
            return fileToBlobUrlMap.get(img);
          }
          // Create new blob URL for new file
          return URL.createObjectURL(img);
        }
        return null;
      }).filter(url => url !== null);
      
      console.log('Syncing preview URLs:', {
        productImagesCount: formData.productImages.length,
        expectedUrlsCount: expectedUrls.length,
        currentUrlsCount: currentProductImageUrls.length
      });
      
      // Only update if there's a mismatch
      if (expectedUrls.length !== currentProductImageUrls.length || 
          expectedUrls.some((url, idx) => url !== currentProductImageUrls[idx])) {
        // Revoke old blob URLs that are no longer needed
        currentProductImageUrls.forEach(url => {
          if (url.startsWith('blob:') && !expectedUrls.includes(url)) {
            URL.revokeObjectURL(url);
          }
        });
        setCurrentProductImageUrls(expectedUrls);
        console.log('Preview URLs updated:', expectedUrls.length);
      }
    } else if (formData.productImages && formData.productImages.length === 0 && currentProductImageUrls.length > 0) {
      // Clear preview URLs if productImages is empty
      currentProductImageUrls.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
      setCurrentProductImageUrls([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.productImages]);

  // Render star rating input
  const renderStarRating = (currentRating, onChange) => {
    return (
      <div className="makeFlex gap5">
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} className={`cursorPointer font24 ${star <= currentRating ? "yellowText" : "grayText"}`} onClick={() => onChange(star)} style={{ userSelect: "none" }}>
            ★
          </span>
        ))}
        {currentRating > 0 && (
          <span className="font14 grayText paddingLeft10">
            {currentRating} star{currentRating !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    )
  }

  // Render star rating display
  const renderStarDisplay = (rating) => {
    return (
      <div className="makeFlex gap5 alignCenter">
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} className={`font16 ${star <= rating ? "yellowText" : "grayText"}`}>
            ★
          </span>
        ))}
        <span className="font14 grayText paddingLeft5">({rating})</span>
      </div>
    )
  }

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      // Clear any info messages (but keep actual errors)
      if (error && error.includes('ℹ️')) {
        setError("")
      } else {
        setError("")
      }
      setSuccess("")

      // Validation
      if (!formData.categoryId || !formData.subCategoryId || !formData.productId) {
        setError("Please select category, subcategory, and product")
        return
      }
      if (!formData.name || !formData.email || !formData.comment || !formData.rating) {
        setError("Please fill all required fields (name, email, comment, rating)")
        return
      }
      if (formData.rating < 1 || formData.rating > 5) {
        setError("Rating must be between 1 and 5")
        return
      }

      const formDataToSend = new FormData()
      formDataToSend.append("categoryId", formData.categoryId)
      formDataToSend.append("subCategoryId", formData.subCategoryId)
      formDataToSend.append("productId", formData.productId)
      formDataToSend.append("productName", formData.productName || "")
      formDataToSend.append("userId", formData.userId || "")
      formDataToSend.append("name", formData.name)
      formDataToSend.append("title", formData.title || "")
      formDataToSend.append("email", formData.email)
      formDataToSend.append("comment", formData.comment)
      formDataToSend.append("rating", formData.rating.toString())
      formDataToSend.append("status", formData.status)

      // Handle avatar image
      if (editingId) {
        // In edit mode
        if (formData.avatar === null && currentAvatarUrl) {
          // Image was explicitly removed (had an image before, now null)
          formDataToSend.append("avatar", "")
        } else if (formData.avatar && typeof formData.avatar !== "string") {
          // New file selected (File object)
          formDataToSend.append("avatar", formData.avatar)
        }
        // If formData.avatar is a string (existing URL), don't send it - keeps existing image
      } else {
        // In create mode
        if (formData.avatar && typeof formData.avatar !== "string") {
          formDataToSend.append("avatar", formData.avatar)
        }
      }

      // Handle product images (multiple, up to 6)
      let productImages = formData.productImages || [];
      
      // CRITICAL SAFEGUARD: If editing, always check ref for URLs to prevent data loss
      // This ensures we NEVER lose existing URLs even if state is out of sync
      if (editingId) {
        const urlsInState = productImages.filter(img => typeof img === 'string');
        const urlsInRef = productImagesRef.current.filter(img => typeof img === 'string');
        
        // If state has no URLs but ref has URLs, recover from ref
        if (urlsInState.length === 0 && urlsInRef.length > 0) {
          console.warn('⚠️ CRITICAL: No URLs in state but ref has URLs! Recovering from ref to prevent data loss.');
          console.warn('URLs in ref:', urlsInRef.length, urlsInRef.map(url => url.substring(0, 50) + '...'));
          // Merge: URLs from ref + Files from state
          const filesInState = productImages.filter(img => img instanceof File);
          productImages = [...urlsInRef, ...filesInState];
          console.warn('✅ Recovered productImages:', productImages.length, '- URLs:', urlsInRef.length, '- Files:', filesInState.length);
        } else if (urlsInState.length > 0 && urlsInRef.length > 0 && urlsInState.length !== urlsInRef.length) {
          // If counts don't match, prefer ref (it's more reliable)
          console.warn('⚠️ URL count mismatch: state has', urlsInState.length, 'but ref has', urlsInRef.length, '- using ref');
          const filesInState = productImages.filter(img => img instanceof File);
          productImages = [...urlsInRef, ...filesInState];
        }
      }
      
      const productImageFiles = productImages.filter(img => img instanceof File);
      const productImageUrls = productImages.filter(img => typeof img === 'string');
      
      console.log('=== SUBMITTING PRODUCT IMAGES ===');
      console.log('Total images in formData.productImages:', productImages.length);
      console.log('Product images breakdown:', {
        total: productImages.length,
        files: productImageFiles.length,
        urls: productImageUrls.length,
        editingId: !!editingId,
        productImagesArray: productImages.map((img, idx) => ({
          index: idx,
          type: typeof img === 'string' ? 'URL' : img instanceof File ? 'File' : 'Unknown',
          value: typeof img === 'string' ? img.substring(0, 50) + '...' : img instanceof File ? img.name : img
        }))
      });
      console.log('Existing URLs to preserve:', productImageUrls);
      console.log('New files to upload:', productImageFiles.map(f => f.name));
      
      // CRITICAL VALIDATION: If editing and uploading new files but no URLs, this is a problem
      if (editingId && productImageFiles.length > 0 && productImageUrls.length === 0) {
        console.error('❌ CRITICAL ERROR: Editing review with new files but NO existing URLs found!');
        console.error('This will cause data loss - old images will be deleted!');
        console.error('formData.productImages:', formData.productImages);
        console.error('productImagesRef.current:', productImagesRef.current);
        setError('⚠️ Error: Cannot find existing images. Please refresh and try again.');
        setLoading(false);
        return;
      }
      
      console.log('================================');
      
      if (editingId) {
        // In edit mode
        if (productImages.length === 0 && currentProductImageUrls.length > 0) {
          // All images were explicitly removed
          formDataToSend.append("productImage", "")
          formDataToSend.append("productImages", JSON.stringify([]))
          formDataToSend.append("existingProductImages", JSON.stringify([]))
        } else {
          // Send new files
          productImageFiles.forEach((file, index) => {
            console.log(`Appending product image file ${index + 1}:`, file.name);
            formDataToSend.append("productImages", file)
          })
          // Send existing URLs as JSON array (backend will merge with new files)
          // CRITICAL: Always send existingProductImages with ALL existing URLs (strings only, not Files)
          // This tells the backend which images to preserve
          console.log('Appending existing product image URLs (to preserve):', productImageUrls);
          console.log('Total images in form:', productImages.length, '- Files:', productImageFiles.length, '- URLs:', productImageUrls.length);
          
          // CRITICAL VALIDATION: If editing and uploading new files but no URLs, STOP!
          if (productImageUrls.length === 0 && productImageFiles.length > 0) {
            console.error('❌ CRITICAL ERROR: Editing review with new files but NO existing URLs found!');
            console.error('This will cause data loss - old images will be deleted!');
            console.error('formData.productImages:', formData.productImages);
            console.error('productImagesRef.current:', productImagesRef.current);
            console.error('currentProductImageUrls:', currentProductImageUrls);
            
            // Try to recover URLs from ref as last resort
            const urlsFromRef = productImagesRef.current.filter(img => typeof img === 'string');
            if (urlsFromRef.length > 0) {
              console.warn('⚠️ Recovering URLs from ref:', urlsFromRef.length);
              const existingProductImagesJson = JSON.stringify(urlsFromRef);
              console.log('📤 Sending recovered existingProductImages to backend:', {
                count: urlsFromRef.length,
                urls: urlsFromRef
              });
              formDataToSend.append("existingProductImages", existingProductImagesJson);
            } else {
              setError('⚠️ Error: Cannot find existing images to preserve. Please refresh the page and try again.');
              setLoading(false);
              return;
            }
          } else {
            const existingProductImagesJson = JSON.stringify(productImageUrls);
            console.log('📤 Sending existingProductImages to backend:', {
              count: productImageUrls.length,
              urls: productImageUrls,
              jsonString: existingProductImagesJson,
              jsonLength: existingProductImagesJson.length
            });
            formDataToSend.append("existingProductImages", existingProductImagesJson);
          }
        }
        // Backward compatibility: handle single productImage
        if (formData.productImage === null && currentProductImageUrls.length === 0) {
          formDataToSend.append("productImage", "")
        } else if (formData.productImage && typeof formData.productImage !== "string") {
          formDataToSend.append("productImage", formData.productImage)
        }
      } else {
        // In create mode - only send files
        productImageFiles.forEach((file, index) => {
          console.log(`Appending product image file ${index + 1}:`, file.name);
          formDataToSend.append("productImages", file)
        })
        // Backward compatibility
        if (formData.productImage && typeof formData.productImage !== "string") {
          formDataToSend.append("productImage", formData.productImage)
        }
      }

      let response
      if (editingId) {
        // Update existing review
        response = await api.put(`/reviews/${editingId}`, formDataToSend, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        setSuccess(`✅ Review updated successfully!`)
      } else {
        // Create new review
        response = await api.post("/reviews", formDataToSend, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        setSuccess(`✅ Review created successfully!`)
      }

      console.log("Review saved:", response.data)
      console.log("Review productImages:", response.data?.productImages)
      console.log("Review productImages count:", response.data?.productImages?.length || 0)
      console.log("Review productImages details:", response.data?.productImages?.map((img, idx) => `${idx + 1}: ${typeof img === 'string' ? img.substring(0, 50) + '...' : 'File'}`))
      
      // Verify that all images were saved
      const savedImageCount = response.data?.productImages?.length || 0;
      const submittedImageCount = productImages.length;
      const submittedUrlCount = productImageUrls.length;
      const submittedFileCount = productImageFiles.length;
      
      console.log("Image submission summary:", {
        submittedTotal: submittedImageCount,
        submittedUrls: submittedUrlCount,
        submittedFiles: submittedFileCount,
        savedTotal: savedImageCount
      });
      
      if (savedImageCount < submittedUrlCount + submittedFileCount) {
        console.warn(`Image count mismatch: Submitted ${submittedImageCount} (${submittedUrlCount} URLs + ${submittedFileCount} files), Saved ${savedImageCount}`);
        setError(`⚠️ Warning: Submitted ${submittedImageCount} image(s) but only ${savedImageCount} were saved. Please check the review.`);
      } else {
        // Clear any errors before showing success
        setError("")
      }
      
      // Refresh reviews list to show the new/updated review with images
      // Use a fresh API call to ensure we get the latest data
      try {
        const params = new URLSearchParams({
          showInactive: "true",
          includeDeleted: "true",
        })
        if (statusFilter && statusFilter !== "all") {
          params.append("status", statusFilter)
        }
        if (sourceFilter && sourceFilter !== "all") {
          params.append("source", sourceFilter)
        }
        if (ratingFilter && ratingFilter !== "all") {
          params.append("rating", ratingFilter)
        }
        
        console.log("Refreshing reviews after save...")
        const refreshResponse = await api.get(`/reviews?${params.toString()}`)
        let refreshedReviewsData = refreshResponse.data.reviews || refreshResponse.data || []
        console.log(`Refreshed ${refreshedReviewsData.length} reviews`)
        
        // Process reviews with cache-buster so card view shows updated images immediately
        const refreshCacheBuster = Date.now()
        const processedRefreshedReviews = (Array.isArray(refreshedReviewsData) ? refreshedReviewsData : []).map(review => {
          let avatarUrl = review.avatar
          let productImageUrl = review.productImage
          let productImageUrlsArr = []
          
          if (avatarUrl) {
            avatarUrl = addCacheBuster(normalizeImageUrl(avatarUrl), refreshCacheBuster)
          }
          
          if (review.productImages && Array.isArray(review.productImages) && review.productImages.length > 0) {
            productImageUrlsArr = review.productImages.map(img => {
              if (typeof img === 'string' && img.trim() !== '') {
                return addCacheBuster(normalizeImageUrl(img), refreshCacheBuster)
              }
              return null
            }).filter(img => img !== null)
          } else if (productImageUrl) {
            productImageUrl = addCacheBuster(normalizeImageUrl(productImageUrl), refreshCacheBuster)
            productImageUrlsArr = [productImageUrl]
          }
          
          return {
            ...review,
            avatar: avatarUrl,
            productImage: productImageUrl,
            productImages: productImageUrlsArr
          }
        })
        
        // Update reviews state
        setReviews(processedRefreshedReviews)
        
        // Force update displayedCards for card view
        if (viewMode === "card") {
          const newDisplayedCards = processedRefreshedReviews.slice(0, 12)
          setDisplayedCards(newDisplayedCards)
          setHasMoreCards(processedRefreshedReviews.length > 12)
          setCurrentPage(1)
          console.log(`Card view updated with ${newDisplayedCards.length} cards`)
        }
      } catch (refreshErr) {
        console.error("Error refreshing reviews:", refreshErr)
        // Fall back to the original fetchReviews
        await fetchReviews()
      }
      
      // Reset form after successful submission (for both add and edit)
      resetForm()
    } catch (err) {
      console.error("Review save error:", err)
      console.error("Error response:", err.response?.data)
      console.error("Error status:", err.response?.status)
      
      let errorMessage = err.response?.data?.msg || err.response?.data?.error || err.message || "Please try again."
      
      // Handle authentication errors specifically
      if (err.response?.status === 401) {
        if (errorMessage.toLowerCase().includes("token") || errorMessage.toLowerCase().includes("authorized")) {
          errorMessage = "Your session has expired. Please log out and log back in to continue."
        } else {
          errorMessage = "Authentication failed. Please log out and log back in."
        }
      } else if (err.response?.status === 403) {
        errorMessage = "Access denied. You don't have permission to perform this action."
      }
      
      setError(`❌ Failed to ${editingId ? "update" : "create"} review: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  // Reset form
  const resetForm = () => {
    setFormData(initialFormData)
    productImagesRef.current = [] // Clear ref
    setCurrentAvatarUrl(null)
    setCurrentProductImageUrls([])
    setEditingId(null)
    setSubcategories([])
    setProducts([])
    setError("")
    // Clear file inputs
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
    }
    if (productImageInputRef.current) {
      productImageInputRef.current.value = '';
    }
    // Don't clear success message here - let AlertMessage handle it
    // setSuccess("");
  }

  // Clear form after successful operations
  const clearForm = () => {
    setFormData(initialFormData)
    productImagesRef.current = [] // Clear ref
    setCurrentAvatarUrl(null)
    setCurrentProductImageUrls([])
    setEditingId(null)
    setSubcategories([])
    setProducts([])
    setError("")
    setSuccess("")
    // Clear file inputs
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
    }
    if (productImageInputRef.current) {
      productImageInputRef.current.value = '';
    }
  }

  // Handle remove avatar
  const handleRemoveAvatar = () => {
    setFormData((prev) => ({ ...prev, avatar: null }))
    setCurrentAvatarUrl(null)
    if (avatarInputRef.current) {
      avatarInputRef.current.value = ''
    }
  }

  // Handle remove product image (remove all)
  const handleRemoveProductImage = () => {
    setFormData((prev) => ({ ...prev, productImage: null, productImages: [] }))
    productImagesRef.current = [] // Clear ref
    // Revoke all blob URLs before clearing
    currentProductImageUrls.forEach(url => {
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url)
      }
    })
    setCurrentProductImageUrls([])
    if (productImageInputRef.current) {
      productImageInputRef.current.value = ''
    }
  }
  
  // Handle remove single product image from array (by index)
  const handleRemoveSingleProductImage = (indexToRemove) => {
    setFormData((prev) => {
      const current = prev.productImages || []
      if (indexToRemove < 0 || indexToRemove >= current.length) return prev
      // Remove only the item at this index
      const updatedImages = current.filter((_, i) => i !== indexToRemove)
      productImagesRef.current = updatedImages
      return {
        ...prev,
        productImages: updatedImages,
        productImage: updatedImages.length > 0
          ? (updatedImages[0] instanceof File ? updatedImages[0] : updatedImages[0])
          : null
      }
    })
    setCurrentProductImageUrls((prev) => {
      if (indexToRemove < 0 || indexToRemove >= prev.length) return prev
      const urlToRevoke = prev[indexToRemove]
      if (urlToRevoke && urlToRevoke.startsWith('blob:')) {
        URL.revokeObjectURL(urlToRevoke)
      }
      return prev.filter((_, i) => i !== indexToRemove)
    })
  }


  // Handle image click to show popup
  const handleImageClick = (imageUrl) => {
    if (imageUrl) {
      setImagePopup({
        isVisible: true,
        imageUrl: imageUrl
      })
    }
  }

  // Handle close image popup
  const handleCloseImagePopup = () => {
    setImagePopup({
      isVisible: false,
      imageUrl: null
    })
  }

  // Fetch reviews
  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        showInactive: "true",
        includeDeleted: "true",
      })

      // Only add filter parameters if they are not "all"
      // When "all" is selected, don't send the parameter so backend shows all items
      if (statusFilter && statusFilter !== "all") {
        params.append("status", statusFilter)
      }
      if (sourceFilter && sourceFilter !== "all") {
        params.append("source", sourceFilter)
      }
      if (ratingFilter && ratingFilter !== "all") {
        params.append("rating", ratingFilter)
      }
      if (debouncedSearchQuery.trim()) {
        params.append("search", debouncedSearchQuery.trim())
      }
      
      // Note: Date filters (today, weekly, monthly) are handled client-side after fetching

      console.log("Fetching reviews with params:", params.toString())
      const response = await api.get(`/reviews?${params.toString()}`)
      let reviewsData = response.data.reviews || response.data || []
      console.log(`Fetched ${reviewsData.length} reviews`)
      
      // Apply date filter client-side if needed
      if (filterFromUrl) {
        const now = new Date();
        let filterDate = null;
        
        if (filterFromUrl === 'today') {
          filterDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (filterFromUrl === 'weekly') {
          filterDate = new Date(now);
          filterDate.setDate(now.getDate() - 7);
        } else if (filterFromUrl === 'monthly') {
          filterDate = new Date(now);
          filterDate.setMonth(now.getMonth() - 1);
        }
        
        if (filterDate) {
          reviewsData = reviewsData.filter(review => {
            const reviewDate = new Date(review.createdAt);
            return reviewDate >= filterDate;
          });
          console.log(`Filtered to ${reviewsData.length} reviews for ${filterFromUrl}`);
        }
      }
      
      // Process reviews: normalize image URLs and add cache-buster so card/edit show correct images
      const cacheBuster = Date.now();
      const processedReviews = (Array.isArray(reviewsData) ? reviewsData : []).map(review => {
        const rawAvatar = review.avatar;
        const rawProductImage = review.productImage;
        let avatarUrl = null;
        let productImageUrl = null;
        let productImageUrls = [];

        if (rawAvatar && typeof rawAvatar === "string" && rawAvatar.trim() !== "") {
          const normalized = normalizeImageUrl(rawAvatar.trim());
          avatarUrl = normalized ? addCacheBuster(normalized, cacheBuster) : null;
        }

        if (review.productImages && Array.isArray(review.productImages) && review.productImages.length > 0) {
          productImageUrls = review.productImages
            .filter(img => typeof img === "string" && img.trim() !== "")
            .map(img => {
              const normalized = normalizeImageUrl(img.trim());
              return normalized ? addCacheBuster(normalized, cacheBuster) : null;
            })
            .filter(Boolean);
          productImageUrl = productImageUrls.length > 0 ? productImageUrls[0] : null;
        } else if (rawProductImage && typeof rawProductImage === "string" && rawProductImage.trim() !== "") {
          const normalized = normalizeImageUrl(rawProductImage.trim());
          productImageUrl = normalized ? addCacheBuster(normalized, cacheBuster) : null;
          productImageUrls = productImageUrl ? [productImageUrl] : [];
        }

        return {
          ...review,
          avatar: avatarUrl,
          productImage: productImageUrl,
          productImages: productImageUrls
        };
      });
      
      setReviews(processedReviews)
      setError("")
    } catch (err) {
      console.error("Error fetching reviews:", err)
      setError(`Failed to fetch reviews: ${err.response?.data?.msg || err.message}`)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, sourceFilter, ratingFilter, debouncedSearchQuery, filterFromUrl])

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 500) // 500ms debounce

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch reviews when filters change
  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  // Update filters when URL params change
  useEffect(() => {
    const statusParam = searchParams.get('status');
    const sourceParam = searchParams.get('source');
    const filterParam = searchParams.get('filter');
    
    if (statusParam && statusParam !== statusFilter) {
      setStatusFilter(statusParam);
    }
    if (sourceParam && sourceParam !== sourceFilter) {
      setSourceFilter(sourceParam);
    }
  }, [searchParams]);
  
  // Fetch dropdown data on mount
  useEffect(() => {
    fetchDropdownData()
  }, [])

  // Filter reviews based on search query (client-side filtering removed since API handles it)
  const filteredReviews = useMemo(() => {
    // API already handles all filtering, so just return reviews as-is
    return reviews
  }, [reviews])

  // Pagination calculations
  const totalPages = Math.ceil(filteredReviews.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentReviews = filteredReviews.slice(startIndex, endIndex)

  // Card lazy loading logic
  useEffect(() => {
    if (viewMode === "card") {
      const initialCards = filteredReviews.slice(0, 12)
      setDisplayedCards(initialCards)
      setHasMoreCards(filteredReviews.length > 12)
      setCurrentPage(1)
    }
  }, [viewMode, filteredReviews])

  // Handle page change
  const handlePageChange = useCallback((pageNumber) => {
    setCurrentPage(pageNumber)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  // Handle lazy loading for card view
  const handleLoadMoreCards = useCallback(() => {
    setDisplayedCards((prevCards) => {
      const currentCardCount = prevCards.length
      const nextCards = filteredReviews.slice(currentCardCount, currentCardCount + 12)

      if (nextCards.length > 0) {
        setHasMoreCards(currentCardCount + nextCards.length < filteredReviews.length)
        return [...prevCards, ...nextCards]
      } else {
        setHasMoreCards(false)
        return prevCards
      }
    })
  }, [filteredReviews])

  // Handle view mode change
  const handleViewModeChange = useCallback(
    (mode) => {
      setViewMode(mode)
      setCurrentPage(1)
      if (mode === "card") {
        const initialCards = filteredReviews.slice(0, 12)
        setDisplayedCards(initialCards)
        setHasMoreCards(filteredReviews.length > 12)
      }
    },
    [filteredReviews]
  )

  // Handle edit
  const handleEdit = (review) => {
    // Use review's avatar/productImages as-is (already full URLs from list processing; may include cache-buster)
    const avatarUrl = review.avatar && typeof review.avatar === 'string' && review.avatar.trim() !== ''
      ? review.avatar
      : null;

    let productImageUrls = []
    if (review.productImages && Array.isArray(review.productImages) && review.productImages.length > 0) {
      productImageUrls = review.productImages
        .filter(img => typeof img === 'string' && img.trim() !== '')
        .map(url => url)
    } else if (review.productImage && typeof review.productImage === 'string' && review.productImage.trim() !== '') {
      productImageUrls = [review.productImage]
    }

    // Ensure display URLs are absolute (normalize if we got relative paths from API)
    const avatarForDisplay = avatarUrl ? (avatarUrl.startsWith('http') ? avatarUrl : normalizeImageUrl(avatarUrl)) : null
    const productUrlsForDisplay = productImageUrls.map(url => url.startsWith('http') ? url : normalizeImageUrl(url))
    const productImageFirst = productImageUrls.length > 0 ? productImageUrls[0] : null

    setFormData({
      categoryId: review.categoryId?._id || review.categoryId || "",
      subCategoryId: review.subCategoryId?._id || review.subCategoryId || "",
      productId: review.productId?._id || review.productId || "",
      productName: review.productName || "",
      userId: review.userId || "",
      name: review.name || "",
      avatar: avatarUrl || null,
      title: review.title || "",
      email: review.email || "",
      comment: review.comment || "",
      rating: review.rating || 0,
      productImage: productImageFirst || null,
      productImages: productImageUrls,
      status: review.status || "approved",
      source: review.source || "admin",
    })

    productImagesRef.current = productImageUrls

    setCurrentAvatarUrl(avatarForDisplay || null)
    setCurrentProductImageUrls(productUrlsForDisplay)
    
    setEditingId(review._id || review.id)
    setError("")
    setSuccess("")

    // Fetch subcategories and products for the selected category/subcategory
    const categoryId = review.categoryId?._id || review.categoryId
    const subCategoryId = review.subCategoryId?._id || review.subCategoryId

    if (categoryId) {
      fetchSubcategories(categoryId)
    }
    if (subCategoryId) {
      fetchProducts(subCategoryId)
    }

    // Scroll to form
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
      }
      if (nameInputRef.current) {
        nameInputRef.current.focus()
      }
    }, 100)
  }

  // Handle delete
  const handleDelete = async (reviewId) => {
    const review = reviews.find((r) => r._id === reviewId)
    const isAlreadyDeleted = review?.deleted

    let message
    let isPermanentDelete = false

    if (isAlreadyDeleted) {
      message = "This review is already marked as deleted. Click OK to permanently remove it from the database. This action cannot be undone."
      isPermanentDelete = true
    } else {
      message = "This will mark the review as inactive and add a deleted flag. Click OK to continue."
      isPermanentDelete = false
    }

    setDeletePopup({
      isVisible: true,
      reviewId,
      message,
      isPermanentDelete,
      action: "delete",
    })
  }

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    const { reviewId, isPermanentDelete } = deletePopup

    try {
      setLoading(true)
      setSuccess("")
      setError("")

      if (isPermanentDelete) {
        await api.delete(`/reviews/${reviewId}/hard`)
        setSuccess(`🗑️ Review has been permanently deleted from the database.`)
      } else {
        await api.delete(`/reviews/${reviewId}`)
        setSuccess(`⏸️ Review has been marked as deleted and inactive.`)
      }

      await fetchReviews()
    } catch (err) {
      const action = isPermanentDelete ? "permanently delete" : "mark as deleted"
      setError(`❌ Failed to ${action} review. ${err.response?.data?.msg || "Please try again."}`)
    } finally {
      setLoading(false)
      setDeletePopup({
        isVisible: false,
        reviewId: null,
        message: "",
        isPermanentDelete: false,
        action: "delete",
      })
    }
  }

  // Handle delete cancellation
  const handleDeleteCancel = () => {
    setDeletePopup({
      isVisible: false,
      reviewId: null,
      message: "",
      isPermanentDelete: false,
      action: "delete",
    })
  }

  // Handle status update
  const handleStatusUpdate = async (reviewId, newStatus) => {
    const statusAction = newStatus === "approved" ? "approve" : newStatus === "rejected" ? "reject" : "set to pending"
    const statusTitle = newStatus === "approved" ? "Approve Review" : newStatus === "rejected" ? "Reject Review" : "Update Status"

    setStatusUpdatePopup({
      isVisible: true,
      reviewId,
      newStatus,
      title: statusTitle,
      message: `Are you sure you want to ${statusAction} this review?`,
    })
  }

  // Handle status update confirmation
  const handleStatusUpdateConfirm = async () => {
    const { reviewId, newStatus } = statusUpdatePopup

    try {
      setLoading(true)
      setSuccess("")
      setError("")

      await api.patch(`/reviews/${reviewId}/status`, { status: newStatus })
      setSuccess(`✅ Review status updated to ${newStatus} successfully!`)

      await fetchReviews()
    } catch (err) {
      console.error("Status update error:", err)
      console.error("Error response:", err.response?.data)
      const errorMessage = err.response?.data?.msg || err.response?.data?.error || err.message || "Please try again."
      setError(`❌ Failed to update review status: ${errorMessage}`)
    } finally {
      setLoading(false)
      setStatusUpdatePopup({
        isVisible: false,
        reviewId: null,
        newStatus: null,
        title: "",
        message: "",
      })
    }
  }

  // Handle status update cancellation
  const handleStatusUpdateCancel = () => {
    setStatusUpdatePopup({
      isVisible: false,
      reviewId: null,
      newStatus: null,
      title: "",
      message: "",
    })
  }

  // Get status badge color
  const getStatusBadgeColor = (status) => {
    switch (status) {
      case "approved":
        return "greenText"
      case "pending":
        return "yellowText"
      case "rejected":
        return "redText"
      default:
        return "grayText"
    }
  }

  // Get source badge color
  const getSourceBadgeColor = (source) => {
    return source === "admin" ? "blueText" : "purpleText"
  }

  return (
    <div className="paddingAll20">
      {/* Header */}
      <PageHeader title="Review Management" subtitle="Manage product reviews from users and create admin reviews" isEditing={!!editingId} editText="Edit Review" createText="Add New Review" />

      {/* Success/Error Messages */}
      <AlertMessage type="success" message={success} onClose={() => setSuccess("")} autoClose={true} />
      <AlertMessage type="error" message={error} onClose={() => setError("")} autoClose={true} />

      {/* Form */}
      <div className="brandFormContainer paddingAll32 appendBottom30" ref={formRef}>
        <form onSubmit={handleSubmit} className="brandForm">
          <h3 className="font20 fontBold appendBottom20">Review Details</h3>

          {/* Product Selection */}
          <div className="makeFlex row gap10 appendBottom16">
            <div className="flexOne">
              <FormField
                type="select"
                name="categoryId"
                label="Category"
                value={formData.categoryId}
                onChange={handleChange}
                required={true}
                options={[
                  { value: "", label: "Select Category" },
                  ...categories.map((cat) => ({
                    value: cat._id || cat.id,
                    label: cat.name,
                  })),
                ]}
              />
            </div>
            <div className="flexOne">
              <FormField
                type="select"
                name="subCategoryId"
                label="Subcategory"
                value={formData.subCategoryId}
                onChange={handleChange}
                required={true}
                disabled={!formData.categoryId}
                options={[
                  { value: "", label: "Select Subcategory" },
                  ...subcategories.map((sub) => ({
                    value: sub._id || sub.id,
                    label: sub.name,
                  })),
                ]}
              />
            </div>
            <div className="flexOne">
              <FormField
                type="select"
                name="productId"
                label="Product"
                value={formData.productId}
                onChange={handleChange}
                required={true}
                disabled={!formData.subCategoryId}
                options={[
                  { value: "", label: formData.subCategoryId ? "Select Product" : "Select Subcategory first" },
                  ...products.map((prod) => ({
                    value: prod._id || prod.id,
                    label: prod.name,
                  })),
                ]}
              />
            </div>
          </div>

          {/* Reviewer Information */}
          <div className="makeFlex row gap10 appendBottom16">
            <div className="flexOne">
              <FormField ref={nameInputRef} type="text" name="name" label="Reviewer Name" value={formData.name} onChange={handleChange} placeholder="Enter reviewer name" required={true} />
            </div>
            <div className="flexOne">
              <FormField type="email" name="email" label="Email" value={formData.email} onChange={handleChange} placeholder="Enter email address" required={true} />
            </div>
            <div className="flexOne">
              <FormField type="text" name="userId" label="User ID (Optional)" value={formData.userId} onChange={handleChange} placeholder="Enter user ID if available" />
            </div>
          </div>

          {/* Avatar Upload */}
          <div className="makeFlex row gap10 appendBottom16">
            <div className="fullWidth">
              <FormField 
                ref={avatarInputRef}
                type="file" 
                name="avatar" 
                label="Avatar Image" 
                onChange={handleChange} 
                accept="image/*" 
                info="Supported formats: JPG, PNG, GIF, WEBP (Max size: 5MB, Max dimensions: 1200x1200px)" 
              />
              {/* Show current avatar if editing and avatar exists */}
              {editingId && currentAvatarUrl && typeof currentAvatarUrl === 'string' && currentAvatarUrl.trim() !== '' && currentAvatarUrl !== 'null' && currentAvatarUrl !== 'undefined' && currentAvatarUrl.length > 0 && (
                <div className="currentImageInfo paddingTop8">
                  <p className="font14 textUppercase blackText fontSemiBold" style={{ marginBottom: '10px' }}>Current avatar:</p>
                  <img
                    src={currentAvatarUrl}
                    alt="Current avatar"
                    className="currentImagePreview"
                    style={{
                      maxWidth: "100px",
                      maxHeight: "100px",
                      objectFit: "cover",
                      borderRadius: "50%",
                      marginTop: "8px",
                      cursor: "pointer",
                    }}
                    onClick={() => handleImageClick(currentAvatarUrl)}
                    onError={(e) => {
                      e.target.style.display = "none"
                    }}
                  />
                  <div>
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="btnSecondary"
                      style={{
                        padding: '4px',
                        fontSize: '12px',
                        backgroundColor: '#ff4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginTop: '10px',
                      }}
                    >
                      Remove Avatar
                    </button>
                  </div>
                </div>
              )}
              {/* Show remove button for newly selected avatar */}
              {!editingId && formData.avatar && formData.avatar instanceof File && (
                <div className="paddingTop8">
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="btnSecondary"
                    style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      backgroundColor: '#ff4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Remove Selected Avatar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Review Content */}
          <div className="makeFlex row gap10 appendBottom16">
            <div className="fullWidth">
              <FormField type="text" name="title" label="Review Title (Optional)" value={formData.title} onChange={handleChange} placeholder="Enter review title" />
            </div>
          </div>

          <div className="makeFlex row gap10 appendBottom16">
            <div className="fullWidth">
              <label className="formLabel appendBottom10">
                Rating <span className="redText">*</span>
              </label>
              {renderStarRating(formData.rating, handleRatingChange)}
            </div>
          </div>

          <div className="makeFlex row gap10 appendBottom16">
            <div className="fullWidth">
              <FormField type="textarea" name="comment" label="Review Comment" value={formData.comment} onChange={handleChange} placeholder="Enter review comment" required={true} rows={4} />
            </div>
          </div>

          {/* Product Images Upload (Multiple, up to 6) */}
          <div className="makeFlex row gap10 appendBottom16">
            <div className="fullWidth">
              <FormField 
                ref={productImageInputRef}
                type="file" 
                name="productImages" 
                label={`Product Images (Optional, up to 6)`}
                onChange={handleChange} 
                accept="image/*" 
                multiple={true}
                info="Supported formats: JPG, PNG, GIF, WEBP (Max size: 5MB each, Max dimensions: 1200x1200px, Max 6 images)" 
              />
              {/* Show current product images count */}
              {(formData.productImages && formData.productImages.length > 0) && (
                <p className={`font12 paddingTop4 ${formData.productImages.length >= 5 ? 'greenText fontSemiBold' : 'grayText'}`}>
                  {formData.productImages.length} / 6 product image(s) selected
                  {formData.productImages.length >= 6 && ' (Maximum reached)'}
                  {/* Debug: Show if arrays are out of sync */}
                  {currentProductImageUrls.length !== formData.productImages.length && (
                    <span className="redText" style={{ fontSize: '10px', display: 'block', marginTop: '4px' }}>
                      ⚠️ Sync issue: Preview shows {currentProductImageUrls.length}, Form has {formData.productImages.length}
                    </span>
                  )}
                </p>
              )}
              
              {/* Show current product images if editing */}
              {editingId && currentProductImageUrls.length > 0 && (
                <div className="currentImageInfo paddingTop8">
                  <p className="font14 textUppercase blackText fontSemiBold" style={{ marginBottom: '10px' }}>
                    Current product images ({currentProductImageUrls.length}):
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {currentProductImageUrls.map((imageUrl, index) => (
                      <div key={`edit-product-img-${index}-${String(imageUrl).slice(0, 40)}`} style={{ position: 'relative', display: 'inline-block' }}>
                        <img
                          src={imageUrl}
                          alt={`Product image ${index + 1}`}
                          className="currentImagePreview"
                          style={{
                            maxWidth: "150px",
                            maxHeight: "150px",
                            objectFit: "cover",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                          onClick={() => handleImageClick(imageUrl)}
                          onError={(e) => {
                            e.target.style.display = "none"
                            const place = e.target.nextElementSibling
                            if (place) place.style.display = "flex"
                          }}
                        />
                        <div
                          aria-hidden
                          style={{
                            display: "none",
                            width: "150px",
                            height: "150px",
                            maxWidth: "150px",
                            maxHeight: "150px",
                            borderRadius: "4px",
                            backgroundColor: "#f0f0f0",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "11px",
                            color: "#888",
                          }}
                        >
                          Image unavailable
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleRemoveSingleProductImage(index); }}
                          className="btnSecondary"
                          style={{
                            position: 'absolute',
                            top: '5px',
                            right: '5px',
                            padding: '2px 6px',
                            fontSize: '10px',
                            backgroundColor: '#ff4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                          title="Remove this image"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={handleRemoveProductImage}
                      className="btnSecondary"
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        backgroundColor: '#ff4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Remove All Product Images
                    </button>
                  </div>
                </div>
              )}
              
              {/* Show preview for newly selected product images (create mode) */}
              {!editingId && currentProductImageUrls.length > 0 && (
                <div className="paddingTop8">
                  <p className="font14 textUppercase blackText fontSemiBold" style={{ marginBottom: '10px' }}>
                    Selected images ({currentProductImageUrls.length}):
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {currentProductImageUrls.map((imageUrl, index) => (
                      <div key={`new-product-img-${index}-${String(imageUrl).slice(0, 40)}`} style={{ position: 'relative', display: 'inline-block' }}>
                        <img
                          src={imageUrl}
                          alt={`Selected image ${index + 1}`}
                          style={{
                            maxWidth: "150px",
                            maxHeight: "150px",
                            objectFit: "cover",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                          onClick={() => handleImageClick(imageUrl)}
                          onError={(e) => {
                            e.target.style.display = "none"
                            const place = e.target.nextElementSibling
                            if (place) place.style.display = "flex"
                          }}
                        />
                        <div
                          aria-hidden
                          style={{
                            display: "none",
                            width: "150px",
                            height: "150px",
                            maxWidth: "150px",
                            maxHeight: "150px",
                            borderRadius: "4px",
                            backgroundColor: "#f0f0f0",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "11px",
                            color: "#888",
                          }}
                        >
                          Image unavailable
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleRemoveSingleProductImage(index); }}
                          className="btnSecondary"
                          style={{
                            position: 'absolute',
                            top: '5px',
                            right: '5px',
                            padding: '2px 6px',
                            fontSize: '10px',
                            backgroundColor: '#ff4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                          title="Remove this image"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveProductImage}
                    className="btnSecondary"
                    style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      backgroundColor: '#ff4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginTop: '10px'
                    }}
                  >
                    Remove All Selected Images
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Status (for admin-created reviews) */}
          <div className="makeFlex row gap10 appendBottom16">
            <div className="fullWidth">
              <FormField
                type="select"
                name="status"
                label="Status"
                value={formData.status}
                onChange={handleChange}
                options={[
                  { value: "approved", label: "Approved" },
                  { value: "pending", label: "Pending" },
                  { value: "rejected", label: "Rejected" },
                ]}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="formActions paddingTop16">
            <button type="submit" disabled={loading} className="btnPrimary">
              {loading ? <span className="loadingSpinner">⏳</span> : <span>{editingId ? "Update Review" : "Add Review"}</span>}
            </button>

            {editingId && (
              <button type="button" onClick={resetForm} className="btnSecondary">
                Cancel
              </button>
            )}

            {!editingId && success && (
              <button type="button" onClick={clearForm} className="btnSecondary">
                Add Another Review
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Reviews List */}
      <div className="brandsListContainer paddingAll32">
        <div className="listHeader makeFlex spaceBetween end appendBottom24">
          <div className="leftSection">
            <h2 className="listTitle font30 fontBold blackText appendBottom16">Reviews ({filteredReviews.length})</h2>

            <div className="makeFlex row gap10 appendBottom20 wrap">
              <div className="minWidth150">
                <FormField
                  type="select"
                  name="statusFilter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  options={[
                    { value: "all", label: "All Status" },
                    { value: "pending", label: "Pending" },
                    { value: "approved", label: "Approved" },
                    { value: "rejected", label: "Rejected" }
                  ]}
                />
              </div>
              <div className="minWidth150">
                <FormField
                  type="select"
                  name="sourceFilter"
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  options={[
                    { value: "all", label: "All Sources" },
                    { value: "admin", label: "Admin" },
                    { value: "user", label: "User" }
                  ]}
                />
              </div>
              <div className="minWidth150">
                <FormField
                  type="select"
                  name="ratingFilter"
                  value={ratingFilter}
                  onChange={(e) => setRatingFilter(e.target.value)}
                  options={[
                    { value: "all", label: "All Ratings" },
                    { value: "5", label: "5 Stars" },
                    { value: "4", label: "4 Stars" },
                    { value: "3", label: "3 Stars" },
                    { value: "2", label: "2 Stars" },
                    { value: "1", label: "1 Star" }
                  ]}
                />
              </div>
            </div>
          </div>
          <div className="rightSection makeFlex end gap10">
            <SearchField value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search reviews..." disabled={loading} minWidth="250px" />
            {loading && <div className="loadingIndicator grayText">Loading...</div>}
            <ViewToggle viewMode={viewMode} onViewChange={handleViewModeChange} disabled={loading} />
          </div>
        </div>
      {loading && !reviews.length ? (
        <div className="textCenter paddingAll40">
          <p className="font16 grayText">Loading reviews...</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="textCenter paddingAll40">
          <p className="font16 grayText">No reviews found</p>
        </div>
      ) : viewMode === "card" && (
        <div className="brandsGrid">
            {displayedCards.map((review) => {
              // Use processed avatar/productImages from state (already full URLs with cache-buster)
              const avatarSrc = review.avatar && (review.avatar.startsWith("http") ? review.avatar : normalizeImageUrl(review.avatar));
              const reviewForCard = {
                ...review,
                avatar: avatarSrc || review.avatar
              };
              return (
              <EntityCard
                key={review._id || review.id}
                entity={reviewForCard}
                imageField="avatar"
                imageAltField="name"
                showImage={true}
                titleField="name"
                subtitleField="email"
                idField="_id"
                showId={false}
                renderHeader={(r) => {
                  const src = r.avatar && (r.avatar.startsWith("http") ? r.avatar : normalizeImageUrl(r.avatar));
                  return (
                    <div className="entityCardHeader makeFlex top gap10">
                      {src && (
                        <div className="entityLogo">
                          <img
                            src={src}
                            alt={r.name || "Avatar"}
                            className="entityLogoImage"
                            style={{ borderRadius: "50%", width: "60px", height: "60px", objectFit: "cover", cursor: "pointer" }}
                            onClick={() => handleImageClick(src)}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.style.visibility = "hidden";
                            }}
                          />
                        </div>
                      )}
                      <div className="entityInfo flexOne">
                        <h3 className="entityName font18 fontBold blackText appendBottom4">{r.name}</h3>
                        <p className="entitySubtitle font12 grayText appendBottom4">{r.email}</p>
                        {r.title && <p className="font14 blackText appendBottom4">{r.title}</p>}
                        <div className="makeFlex gap10 appendBottom4">
                          <span className={`font12 ${getStatusBadgeColor(r.status)}`}>{r.status?.toUpperCase()}</span>
                          <span className={`font12 ${getSourceBadgeColor(r.source)}`}>{r.source?.toUpperCase()}</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
                renderDetails={(review) => (
                  <div>
                    {review.productId && (
                      <div className="appendBottom10">
                        <p className="font12 grayText">Product:</p>
                        <p className="font14 blackText fontBold">{review.productId?.name || review.productName || "N/A"}</p>
                      </div>
                    )}
                    {review.comment && (
                      <div className="appendBottom10">
                        <p className="font12 grayText">Comment:</p>
                        <p className="font14 blackText">{review.comment}</p>
                      </div>
                    )}
                    <div className="appendBottom10">{renderStarDisplay(review.rating)}</div>
                    {/* Display multiple product images (use processed URLs from state) */}
                    {review.productImages && review.productImages.length > 0 && (
                      <div className="appendBottom10">
                        <p className="font12 grayText appendBottom4">Product Images ({review.productImages.length}):</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {review.productImages.map((imageUrl, index) => {
                            const src = imageUrl && (imageUrl.startsWith("http") ? imageUrl : normalizeImageUrl(imageUrl));
                            if (!src) return null;
                            return (
                              <div key={`card-${review._id}-img-${index}`} style={{ position: "relative", display: "inline-block" }}>
                                <img
                                  src={src}
                                  alt={`Product image ${index + 1}`}
                                  style={{
                                    maxWidth: "100px",
                                    maxHeight: "100px",
                                    objectFit: "cover",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                  }}
                                  onClick={() => handleImageClick(src)}
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.style.display = "none";
                                    const place = e.target.nextElementSibling;
                                    if (place) place.style.display = "flex";
                                  }}
                                />
                                <div
                                  aria-hidden
                                  style={{
                                    display: "none",
                                    width: "100px",
                                    height: "100px",
                                    maxWidth: "100px",
                                    maxHeight: "100px",
                                    borderRadius: "4px",
                                    backgroundColor: "#f0f0f0",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "10px",
                                    color: "#888",
                                  }}
                                >
                                  Unavailable
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {/* Fallback to single productImage for backward compatibility */}
                    {(!review.productImages || review.productImages.length === 0) && review.productImage && (
                      <div className="appendBottom10">
                        {(() => {
                          const src = review.productImage.startsWith("http") ? review.productImage : normalizeImageUrl(review.productImage);
                          if (!src) return null;
                          return (
                            <img
                              src={src}
                              alt="Product image"
                              style={{
                                maxWidth: "100%",
                                maxHeight: "150px",
                                objectFit: "cover",
                                borderRadius: "4px",
                                cursor: "pointer",
                              }}
                              onClick={() => handleImageClick(src)}
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.style.visibility = "hidden";
                              }}
                            />
                          );
                        })()}
                      </div>
                    )}
                    {review.reviewedBy && (
                      <div className="appendBottom10">
                        <p className="font12 grayText">
                          Reviewed by: {review.reviewedBy} {review.reviewedAt && `on ${new Date(review.reviewedAt).toLocaleDateString()}`}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="font12 grayText">Created: {new Date(review.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}
                renderActions={(review) => (
                  <div className="entityCardActions makeFlex gap10 wrap">
                    {review.status === "pending" && (
                      <>
                        <button onClick={() => handleStatusUpdate(review._id || review.id, "approved")} className="btnSuccess flexOne" disabled={loading}>
                          ✓ Approve
                        </button>
                        <button onClick={() => handleStatusUpdate(review._id || review.id, "rejected")} className="btnDanger flexOne" disabled={loading}>
                          ✗ Reject
                        </button>
                      </>
                    )}
                    <button onClick={() => handleEdit(review)} className="btnEdit flexOne" disabled={loading}>
                      ✏️ Edit
                    </button>
                    <button onClick={() => handleDelete(review._id || review.id)} className="btnDelete flexOne" disabled={loading}>
                      🗑️ Delete
                    </button>
                  </div>
                )}
              />
              );
            })}

            {hasMoreCards && (
              <div className="textCenter paddingTop20">
                <button onClick={handleLoadMoreCards} className="btnSecondary" disabled={loading}>
                  Load More Reviews
                </button>
              </div>
            )}
        </div>
      )}
      {viewMode === "list" && (
        <div className="brandsListTable">
          <div className="dataTable">
            <table className="fullWidth">
              <thead>
                <tr>
                  <th>Reviewer</th>
                  <th>Product</th>
                  <th>Rating</th>
                  <th>Comment</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentReviews.map((review) => (
                  <tr key={review._id || review.id}>
                    <td>
                      <div className="makeFlex gap10 alignCenter">
                        {review.avatar && (() => {
                          const normalizedAvatar = normalizeImageUrl(review.avatar);
                          return (
                            <img
                              src={normalizedAvatar}
                              alt={review.name}
                              style={{
                                width: "40px",
                                height: "40px",
                                borderRadius: "50%",
                                objectFit: "cover",
                                cursor: "pointer",
                              }}
                              onClick={() => handleImageClick(normalizedAvatar)}
                              onError={(e) => {
                                e.target.style.display = "none"
                              }}
                            />
                          );
                        })()}
                        <div>
                          <p className="font14 fontBold">{review.name}</p>
                          <p className="font12 grayText">{review.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p className="font14">{review.productId?.name || review.productName || "N/A"}</p>
                    </td>
                    <td>{renderStarDisplay(review.rating)}</td>
                    <td>
                      <p className="font14" style={{ maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {review.comment}
                      </p>
                    </td>
                    <td>
                      <span className={`font12 ${getStatusBadgeColor(review.status)}`}>{review.status?.toUpperCase()}</span>
                    </td>
                    <td>
                      <span className={`font12 ${getSourceBadgeColor(review.source)}`}>{review.source?.toUpperCase()}</span>
                    </td>
                    <td>
                      <p className="font12">{new Date(review.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td>
                      <div className="makeFlex gap5">
                        {review.status === "pending" && (
                          <>
                            <button onClick={() => handleStatusUpdate(review._id || review.id, "approved")} className="btnSuccess btnSmall" disabled={loading} title="Approve">
                              ✓
                            </button>
                            <button onClick={() => handleStatusUpdate(review._id || review.id, "rejected")} className="btnDanger btnSmall" disabled={loading} title="Reject">
                              ✗
                            </button>
                          </>
                        )}
                        <button onClick={() => handleEdit(review)} className="btnEdit btnSmall" disabled={loading} title="Edit">
                          ✏️
                        </button>
                        <button onClick={() => handleDelete(review._id || review.id)} className="btnDelete btnSmall" disabled={loading} title="Delete">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="paddingTop20">
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
            </div>
          )}
        </div>
      )}
      </div>

      {/* Delete Confirmation Popup */}
      <DeleteConfirmationPopup isVisible={deletePopup.isVisible} message={deletePopup.message} onConfirm={handleDeleteConfirm} onCancel={handleDeleteCancel} isPermanentDelete={deletePopup.isPermanentDelete} />

      {/* Image Popup */}
      {imagePopup.isVisible && (
        <div 
          className="imagePopupOverlay"
          onClick={handleCloseImagePopup}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            cursor: 'pointer'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
            }}
          >
            <button
              onClick={handleCloseImagePopup}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: '#ff4444',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10001
              }}
              aria-label="Close image"
            >
              ×
            </button>
            <img
              src={imagePopup.imageUrl}
              alt="Full size preview"
              style={{
                maxWidth: '100%',
                maxHeight: '85vh',
                objectFit: 'contain',
                display: 'block'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        </div>
      )}

      {/* Status Update Confirmation Popup */}
      {statusUpdatePopup.isVisible && (
        <div className="modalOverlay" onClick={handleStatusUpdateCancel}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <div style={{ borderBottom: "1px solid #e5e7eb", paddingBottom: "16px", marginBottom: "16px" }}>
              <h3 className="font20 fontBold" style={{ margin: 0, color: "#111827" }}>
                {statusUpdatePopup.title || "Confirm Status Update"}
              </h3>
            </div>
            <p className="font16 appendBottom24" style={{ color: "#374151", lineHeight: "1.5" }}>
              {statusUpdatePopup.message}
            </p>
            <div className="makeFlex gap10">
              <button onClick={handleStatusUpdateConfirm} className={statusUpdatePopup.newStatus === "approved" ? "btnSuccess flexOne" : statusUpdatePopup.newStatus === "rejected" ? "btnDanger flexOne" : "btnPrimary flexOne"} disabled={loading} style={{ padding: "12px 24px", fontSize: "14px", fontWeight: "600" }}>
                {loading ? "Processing..." : "Confirm"}
              </button>
              <button onClick={handleStatusUpdateCancel} className="btnSecondary flexOne" style={{ padding: "12px 24px", fontSize: "14px", fontWeight: "600" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReviewManager
