"use client"

import { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import api from "../src/utils/api"
import { useMediaQuery } from "../src/hooks/useMediaQuery"
import { ProductCard, GridLayout } from "./FeaturedProductSection"
import NavigationBar from "./NavigationBar"
import Footer from "./Footer"

// Filter block: title + search input + list of options (checkboxes)
function FilterBlock({ title, searchPlaceholder, options, selectedValues, onToggle, searchQuery, onSearchChange }) {
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return options
    const q = searchQuery.toLowerCase()
    return options.filter((opt) => String(opt.label || opt).toLowerCase().includes(q))
  }, [options, searchQuery])

  return (
    <div className="border-b border-gray-200 pb-4 mb-4 last:border-0 last:mb-0 last:pb-0">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">{title}</h3>
      <input
        type="text"
        placeholder={searchPlaceholder}
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 mb-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      <div className="max-h-40 overflow-y-auto space-y-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-500">No matches</p>
        ) : (
          filtered.map((opt) => {
            const value = opt.value ?? opt.id ?? opt
            const label = opt.label ?? opt.name ?? String(opt)
            const count = opt.count
            const checked = selectedValues.includes(value)
            return (
              <label key={value} className="flex items-center justify-between gap-2 text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                <span className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(value)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                  />
                  <span className="truncate">{label}</span>
                </span>
                {typeof count === "number" && (
                  <span className="text-gray-500 flex-shrink-0 tabular-nums">{count}</span>
                )}
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}

// Price filter: min/max inputs
function PriceFilter({ minPrice, maxPrice, onMinChange, onMaxChange, searchPlaceholder = "e.g. 100 - 500" }) {
  return (
    <div className="border-b border-gray-200 pb-4 mb-4 last:border-0 last:mb-0 last:pb-0">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">Price</h3>
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="number"
          placeholder="Min"
          min={0}
          value={minPrice === "" ? "" : minPrice}
          onChange={(e) => onMinChange(e.target.value)}
          className="w-24 text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-gray-400">–</span>
        <input
          type="number"
          placeholder="Max"
          min={0}
          value={maxPrice === "" ? "" : maxPrice}
          onChange={(e) => onMaxChange(e.target.value)}
          className="w-24 text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  )
}

function ProductCardShimmer() {
  return (
    <div className="rounded-lg overflow-hidden border border-gray-100 bg-white h-full">
      <div className="aspect-square bg-gray-200 animate-pulse" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-gray-200 rounded animate-pulse w-[85%]" />
        <div className="h-3 bg-gray-200 rounded animate-pulse w-2/5" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3 mt-2" />
      </div>
    </div>
  )
}

/** Shared filter column / sheet body (desktop sidebar + mobile bottom sheet). */
function CategoryFiltersPanel({
  showTitle = true,
  filterOptions,
  subcategoryOptions,
  subcategorySearch,
  setSubcategorySearch,
  colorSearch,
  setColorSearch,
  sizeSearch,
  setSizeSearch,
  themeSearch,
  setThemeSearch,
  brandSearch,
  setBrandSearch,
  tagSearch,
  setTagSearch,
  selectedSubcategories,
  selectedColors,
  selectedSizes,
  selectedThemes,
  selectedBrands,
  selectedTags,
  minPrice,
  maxPrice,
  toggleSubcategory,
  toggleColor,
  toggleSize,
  toggleTheme,
  toggleBrand,
  toggleTag,
  setMinPrice,
  setMaxPrice,
}) {
  return (
    <>
      {showTitle ? (
        <h2 className="text-lg font-bold text-gray-900 mb-4 uppercase tracking-wide">Filters</h2>
      ) : null}

      <FilterBlock
        title="Brand"
        searchPlaceholder="Search brand..."
        options={filterOptions.brands}
        selectedValues={selectedBrands}
        onToggle={toggleBrand}
        searchQuery={brandSearch}
        onSearchChange={setBrandSearch}
      />

      <FilterBlock
        title="Subcategory"
        searchPlaceholder="Search subcategory..."
        options={subcategoryOptions}
        selectedValues={selectedSubcategories}
        onToggle={toggleSubcategory}
        searchQuery={subcategorySearch}
        onSearchChange={setSubcategorySearch}
      />

      <FilterBlock
        title="Color"
        searchPlaceholder="Search color..."
        options={filterOptions.colors}
        selectedValues={selectedColors}
        onToggle={toggleColor}
        searchQuery={colorSearch}
        onSearchChange={setColorSearch}
      />

      <FilterBlock
        title="Size"
        searchPlaceholder="Search size..."
        options={filterOptions.sizes}
        selectedValues={selectedSizes}
        onToggle={toggleSize}
        searchQuery={sizeSearch}
        onSearchChange={setSizeSearch}
      />

      <PriceFilter minPrice={minPrice} maxPrice={maxPrice} onMinChange={setMinPrice} onMaxChange={setMaxPrice} />

      <FilterBlock
        title="Theme"
        searchPlaceholder="Search theme..."
        options={filterOptions.themes}
        selectedValues={selectedThemes}
        onToggle={toggleTheme}
        searchQuery={themeSearch}
        onSearchChange={setThemeSearch}
      />

      <FilterBlock
        title="Tags"
        searchPlaceholder="Search tag..."
        options={filterOptions.tags}
        selectedValues={selectedTags}
        onToggle={toggleTag}
        searchQuery={tagSearch}
        onSearchChange={setTagSearch}
      />
    </>
  )
}

export default function CategoryPage({ categoryId, initialCategoryName = null, initialProducts = null, initialSubcategories = null }) {
  const [category, setCategory] = useState(initialCategoryName ? { name: initialCategoryName, _id: categoryId } : null)
  const [subcategories, setSubcategories] = useState(initialSubcategories || [])
  const [products, setProducts] = useState(initialProducts || [])
  const [loading, setLoading] = useState(!initialCategoryName)
  const [productsLoading, setProductsLoading] = useState(!initialProducts)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMoreProducts, setHasMoreProducts] = useState((initialProducts?.length || 0) >= 24)
  const PAGE_SIZE = 24

  // Filter state
  const [subcategorySearch, setSubcategorySearch] = useState("")
  const [colorSearch, setColorSearch] = useState("")
  const [sizeSearch, setSizeSearch] = useState("")
  const [themeSearch, setThemeSearch] = useState("")
  const [brandSearch, setBrandSearch] = useState("")
  const [tagSearch, setTagSearch] = useState("")
  const [selectedSubcategories, setSelectedSubcategories] = useState([])
  const [selectedColors, setSelectedColors] = useState([])
  const [selectedSizes, setSelectedSizes] = useState([])
  const [selectedThemes, setSelectedThemes] = useState([])
  const [selectedBrands, setSelectedBrands] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  const [sortBy, setSortBy] = useState("")

  const isMd = useMediaQuery("(min-width: 768px)")
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [sheetDragY, setSheetDragY] = useState(0)
  const sheetDragYRef = useRef(0)
  const touchStartY = useRef(null)
  const [portalReady, setPortalReady] = useState(false)

  useEffect(() => {
    setPortalReady(true)
  }, [])

  const activeFilterCount = useMemo(() => {
    let n =
      selectedSubcategories.length +
      selectedColors.length +
      selectedSizes.length +
      selectedThemes.length +
      selectedBrands.length +
      selectedTags.length
    if (minPrice !== "" || maxPrice !== "") n += 1
    return n
  }, [
    selectedSubcategories,
    selectedColors,
    selectedSizes,
    selectedThemes,
    selectedBrands,
    selectedTags,
    minPrice,
    maxPrice,
  ])

  const closeMobileFilters = useCallback(() => {
    setMobileFiltersOpen(false)
    setSheetDragY(0)
    sheetDragYRef.current = 0
    touchStartY.current = null
  }, [])

  useEffect(() => {
    if (!mobileFiltersOpen || isMd) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e) => {
      if (e.key === "Escape") closeMobileFilters()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [mobileFiltersOpen, isMd, closeMobileFilters])

  const onSheetTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY
  }
  const onSheetTouchMove = (e) => {
    if (touchStartY.current == null) return
    const dy = e.touches[0].clientY - touchStartY.current
    if (dy > 0) {
      sheetDragYRef.current = dy
      setSheetDragY(dy)
    }
  }
  const onSheetTouchEnd = () => {
    if (sheetDragYRef.current > 100) closeMobileFilters()
    else {
      setSheetDragY(0)
      sheetDragYRef.current = 0
    }
    touchStartY.current = null
  }

  // Fetch category name if we only have id
  useEffect(() => {
    if (!categoryId) return
    if (initialCategoryName) {
      setCategory({ name: initialCategoryName, _id: categoryId })
      setLoading(false)
      return
    }
    setLoading(true)
    api
      .get("/categories?showInactive=false&includeDeleted=false", { skipAuth: true })
      .then((res) => {
        const data = res?.data ?? res
        const list = Array.isArray(data) ? data : []
        const found = list.find((c) => (c._id || c.id) === categoryId)
        setCategory(found ? { name: found.name, _id: found._id || found.id } : { name: "Category", _id: categoryId })
      })
      .catch(() => setCategory({ name: "Category", _id: categoryId }))
      .finally(() => setLoading(false))
  }, [categoryId, initialCategoryName])

  // Fetch subcategories for this category only (only the visited category's subcategories)
  useEffect(() => {
    if (!categoryId) {
      setSubcategories([])
      return
    }
    api
      .get(`/subcategories?category=${encodeURIComponent(categoryId)}&showInactive=false&includeDeleted=false`, { skipAuth: true })
      .then((res) => {
        const data = res?.data ?? res
        let list = data?.subcategories ?? (Array.isArray(data) ? data : [])
        if (!Array.isArray(list)) list = []
        // Ensure we only show subcategories that belong to the visited category (client-side filter in case API returns more)
        const currentCategoryId = String(categoryId)
        const belongsToCategory = (sub) => {
          const parentId = sub.category?._id ?? sub.category ?? sub.categoryId?._id ?? sub.categoryId ?? sub.parent?._id ?? sub.parent
          if (parentId == null) return true // no parent field: assume API already filtered by category
          return String(parentId) === currentCategoryId
        }
        setSubcategories(list.filter(belongsToCategory))
      })
      .catch(() => setSubcategories([]))
  }, [categoryId])

  // Build filter options from products (colors, sizes, themes, brands, tags) with counts per option
  const filterOptions = useMemo(() => {
    const colors = new Map()
    const sizes = new Map()
    const themes = new Map()
    const brands = new Map()
    const tags = new Map()
    const addCount = (map, key, value, label) => {
      const k = key ?? value ?? label
      if (!k) return
      if (!map.has(k)) map.set(k, { value: k, label: label ?? k, count: 0 })
      map.get(k).count += 1
    }
    products.forEach((p) => {
      const colorNames = new Set(
        (p.colors || p.variants?.map((v) => v.color) || [])
          .map((c) => c?.name ?? c?.color ?? c)
          .filter(Boolean),
      )
      colorNames.forEach((name) => addCount(colors, name, name, name))
      const sizeNames = new Set(
        (p.sizes || p.variants?.map((v) => v.size) || [])
          .map((s) => s?.name ?? s?.size ?? s)
          .filter(Boolean),
      )
      sizeNames.forEach((name) => addCount(sizes, name, name, name))
      const themeValues = new Set()
      const themeList = p.themes || (p.theme ? [p.theme] : [])
      themeList.forEach((t) => {
        const name = typeof t === "string" ? t : (t?.name ?? t)
        if (name && String(name).trim()) themeValues.add(String(name).trim())
      })
      ;["occasion", "style", "design"].forEach((field) => {
        const val = p[field]
        if (val == null) return
        const parts = typeof val === "string" ? val.split(",").map((s) => s.trim()).filter(Boolean) : []
        parts.forEach((name) => themeValues.add(name))
      })
      themeValues.forEach((name) => addCount(themes, name, name, name))
      const brandList = p.brand ? [p.brand] : (p.brands || [])
      brandList.forEach((b) => {
        const name = b?.name ?? b
        if (name) addCount(brands, name, name, name)
      })
      let tagList = []
      if (Array.isArray(p.tags)) tagList = p.tags
      else if (typeof p.tags === "string" && p.tags.trim()) tagList = p.tags.split(",").map((s) => s.trim()).filter(Boolean)
      else if (p.tag) tagList = [p.tag]
      else if (Array.isArray(p.tagIds) && p.tagIds.length) tagList = p.tagIds.filter(Boolean)
      const tagNames = new Set(
        tagList.map((t) => {
          const name =
            typeof t === "string"
              ? t
              : (t?.name ?? t?.label ?? t?.value ?? (t?.title && String(t.title)) ?? (t?._id && String(t._id)))
          return name && String(name).trim() ? String(name).trim() : null
        }).filter(Boolean),
      )
      tagNames.forEach((name) => addCount(tags, name, name, name))
    })
    const brandArr = Array.from(brands.values()).sort((a, b) => (a.label || "").localeCompare(b.label || ""))
    const tagArr = Array.from(tags.values()).sort((a, b) => (a.label || "").localeCompare(b.label || ""))
    return {
      colors: Array.from(colors.values()),
      sizes: Array.from(sizes.values()),
      themes: Array.from(themes.values()),
      brands: brandArr,
      tags: tagArr,
    }
  }, [products])

  // Fetch products with filters (categoryId optional — when absent show all products)
  useEffect(() => {
    setProductsLoading(true)
    const params = new URLSearchParams()
    params.set("showInactive", "false")
    params.set("includeDeleted", "false")
    params.set("limit", String(PAGE_SIZE))
    if (categoryId) params.set("categoryId", categoryId)
    if (selectedSubcategories.length) params.set("subCategoryId", selectedSubcategories[0])
    selectedColors.forEach((c) => params.append("color", c))
    selectedSizes.forEach((s) => params.append("size", s))
    selectedThemes.forEach((t) => params.append("theme", t))
    selectedBrands.forEach((b) => params.append("brand", b))
    selectedTags.forEach((t) => params.append("tag", t))
    if (minPrice !== "") params.set("minPrice", minPrice)
    if (maxPrice !== "") params.set("maxPrice", maxPrice)

    api
      .get(`/products?${params.toString()}`, { skipAuth: true })
      .then((res) => {
        const data = res?.data ?? res
        const list = data?.products ?? data
        let arr = Array.isArray(list) ? list : []
        if (selectedSubcategories.length > 1) {
          arr = arr.filter((p) => {
            const subId = p.subCategory?._id || p.subCategoryId?._id || p.subCategoryId
            return subId && selectedSubcategories.includes(subId)
          })
        }
        if (selectedColors.length && !params.has("color")) {
          arr = arr.filter((p) => {
            const productColors = p.colors || []
            return productColors.some((c) => selectedColors.includes(c?.name ?? c?.color ?? c))
          })
        }
        if (selectedSizes.length && !params.has("size")) {
          arr = arr.filter((p) => {
            const productSizes = p.sizes || []
            return productSizes.some((s) => selectedSizes.includes(s?.name ?? s?.size ?? s))
          })
        }
        if (selectedThemes.length) {
          arr = arr.filter((p) => {
            const fromRefs = (p.themes || (p.theme ? [p.theme] : [])).map((t) => (typeof t === "string" ? t : (t?.name ?? t))?.trim()).filter(Boolean)
            const fromFields = ["occasion", "style", "design"].flatMap((field) => {
              const val = p[field]
              if (typeof val !== "string" || !val.trim()) return []
              return val.split(",").map((s) => s.trim()).filter(Boolean)
            })
            const productThemeValues = [...new Set([...fromRefs, ...fromFields])]
            return selectedThemes.some((sel) => productThemeValues.includes(sel))
          })
        }
        if (selectedBrands.length) {
          arr = arr.filter((p) => {
            const productBrands = p.brand ? [p.brand] : (p.brands || [])
            return productBrands.some((b) => selectedBrands.includes(b?.name ?? b))
          })
        }
        if (selectedTags.length) {
          arr = arr.filter((p) => {
            let tagList = []
            if (Array.isArray(p.tags)) tagList = p.tags
            else if (typeof p.tags === "string" && p.tags.trim()) tagList = p.tags.split(",").map((s) => s.trim()).filter(Boolean)
            else if (p.tag) tagList = [p.tag]
            else if (Array.isArray(p.tagIds)) tagList = p.tagIds.filter(Boolean)
            const tagNames = tagList.map((t) =>
              typeof t === "string" ? t : (t?.name ?? t?.label ?? t?.value ?? (t?.title && String(t.title)) ?? "").trim(),
            ).filter(Boolean)
            return selectedTags.some((sel) => tagNames.includes(sel))
          })
        }
        if (minPrice !== "" || maxPrice !== "") {
          const min = minPrice === "" ? 0 : Number(minPrice)
          const max = maxPrice === "" ? Infinity : Number(maxPrice)
          arr = arr.filter((p) => {
            const price = p.discountedPrice ?? p.price ?? 0
            return price >= min && price <= max
          })
        }
        setProducts(arr)
        setHasMoreProducts(arr.length >= PAGE_SIZE)
      })
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false))
  }, [categoryId, selectedSubcategories, selectedColors, selectedSizes, selectedThemes, selectedBrands, selectedTags, minPrice, maxPrice])

  const loadMoreProducts = () => {
    if (loadingMore || !hasMoreProducts) return
    setLoadingMore(true)
    const params = new URLSearchParams()
    params.set("showInactive", "false")
    params.set("includeDeleted", "false")
    params.set("limit", String(PAGE_SIZE))
    params.set("skip", String(products.length))
    if (categoryId) params.set("categoryId", categoryId)
    if (selectedSubcategories.length) params.set("subCategoryId", selectedSubcategories[0])
    selectedColors.forEach((c) => params.append("color", c))
    selectedSizes.forEach((s) => params.append("size", s))
    selectedThemes.forEach((t) => params.append("theme", t))
    selectedBrands.forEach((b) => params.append("brand", b))
    selectedTags.forEach((t) => params.append("tag", t))
    if (minPrice !== "") params.set("minPrice", minPrice)
    if (maxPrice !== "") params.set("maxPrice", maxPrice)

    api
      .get(`/products?${params.toString()}`, { skipAuth: true })
      .then((res) => {
        const data = res?.data ?? res
        const list = data?.products ?? data
        const next = Array.isArray(list) ? list : []
        setProducts((prev) => [...prev, ...next])
        setHasMoreProducts(next.length >= PAGE_SIZE)
      })
      .catch(() => setHasMoreProducts(false))
      .finally(() => setLoadingMore(false))
  }

  const toggleSubcategory = (id) => {
    setSelectedSubcategories((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }
  const toggleColor = (v) => {
    setSelectedColors((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }
  const toggleSize = (v) => {
    setSelectedSizes((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }
  const toggleTheme = (v) => {
    setSelectedThemes((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }
  const toggleBrand = (v) => {
    setSelectedBrands((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }
  const toggleTag = (v) => {
    setSelectedTags((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }

  const subcategoryOptions = useMemo(() => {
    const countBySub = new Map()
    products.forEach((p) => {
      const subId = p.subCategory?._id ?? p.subCategoryId?._id ?? p.subCategoryId ?? p.subcategory?._id ?? p.subcategory
      if (subId) {
        const id = String(subId)
        countBySub.set(id, (countBySub.get(id) ?? 0) + 1)
      }
    })
    return subcategories.map((s) => {
      const id = s._id || s.id
      const value = id
      const label = s.name || s.title || String(id)
      return { value, label, count: countBySub.get(String(id)) ?? 0 }
    })
  }, [subcategories, products])

  // Sort options and apply to products
  const SORT_OPTIONS = [
    { value: "", label: "Select Sorting Option" },
    { value: "a-z", label: "A to Z" },
    { value: "price-high", label: "Price High to Low" },
    { value: "price-low", label: "Price Low to High" },
    { value: "newest", label: "Newest" },
    { value: "popularity", label: "Popularity" },
  ]
  const sortedProducts = useMemo(() => {
    if (!sortBy || !products.length) return products
    const arr = [...products]
    switch (sortBy) {
      case "a-z":
        return arr.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }))
      case "price-high": {
        return arr.sort((a, b) => {
          const pa = a.discountedPrice ?? a.price ?? 0
          const pb = b.discountedPrice ?? b.price ?? 0
          return pb - pa
        })
      }
      case "price-low": {
        return arr.sort((a, b) => {
          const pa = a.discountedPrice ?? a.price ?? 0
          const pb = b.discountedPrice ?? b.price ?? 0
          return pa - pb
        })
      }
      case "newest":
        return arr.sort((a, b) => {
          const da = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const db = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return db - da
        })
      case "popularity":
        return arr.sort((a, b) => {
          const sa = a.soldCount ?? a.salesCount ?? a.viewCount ?? 0
          const sb = b.soldCount ?? b.salesCount ?? b.viewCount ?? 0
          return sb - sa
        })
      default:
        return arr
    }
  }, [products, sortBy])

  const filterPanelProps = {
    filterOptions,
    subcategoryOptions,
    subcategorySearch,
    setSubcategorySearch,
    colorSearch,
    setColorSearch,
    sizeSearch,
    setSizeSearch,
    themeSearch,
    setThemeSearch,
    brandSearch,
    setBrandSearch,
    tagSearch,
    setTagSearch,
    selectedSubcategories,
    selectedColors,
    selectedSizes,
    selectedThemes,
    selectedBrands,
    selectedTags,
    minPrice,
    maxPrice,
    toggleSubcategory,
    toggleColor,
    toggleSize,
    toggleTheme,
    toggleBrand,
    toggleTag,
    setMinPrice,
    setMaxPrice,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 w-full">
        <NavigationBar />
      </header>

      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-600 mb-6">
          <Link href="/" className="hover:text-gray-900">
            Home
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{loading ? "..." : (category?.name || (categoryId ? "Category" : "All Products"))}</span>
        </nav>

        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Desktop (md+): filters in sidebar — not mounted on narrow viewports */}
          {isMd ? (
            <aside className="w-full flex-shrink-0 lg:w-64">
              <div className="sticky top-24 rounded-lg border border-gray-200 bg-white p-4">
                <CategoryFiltersPanel showTitle {...filterPanelProps} />
              </div>
            </aside>
          ) : null}

          {/* Products */}
          <main className="min-w-0 flex-1">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="text-xl font-bold uppercase tracking-wide text-gray-900">
                {loading ? "..." : (category?.name || (categoryId ? "Category" : "All Products"))}
              </h1>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {!isMd ? (
                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(true)}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg border-2 border-gray-900 px-4 py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-900 hover:text-white"
                    aria-expanded={mobileFiltersOpen}
                    aria-controls="pp-mobile-filters-sheet"
                  >
                    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                      />
                    </svg>
                    Filters
                    {activeFilterCount > 0 ? (
                      <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs font-bold text-white tabular-nums">
                        {activeFilterCount}
                      </span>
                    ) : null}
                  </button>
                ) : null}
                <span className="text-sm text-gray-500">{products.length} products</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:min-w-[200px] sm:flex-none"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value || "default"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {productsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ProductCardShimmer key={i} />
                ))}
              </div>
            ) : sortedProducts.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <p className="text-gray-600">No products found. Try adjusting your filters.</p>
                <Link href="/" className="mt-4 inline-block text-blue-600 hover:underline">
                  Back to Home
                </Link>
              </div>
            ) : (
              <>
                <GridLayout products={sortedProducts} columns={4} />
                {hasMoreProducts && (
                  <div className="mt-8 flex justify-center">
                    <button
                      type="button"
                      onClick={loadMoreProducts}
                      disabled={loadingMore}
                      className="px-6 py-3 border-2 border-gray-900 text-gray-900 font-semibold rounded-lg hover:bg-gray-900 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingMore ? "Loading..." : "Load more"}
                    </button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {portalReady &&
        !isMd &&
        mobileFiltersOpen &&
        createPortal(
          <div className="fixed inset-0 z-[60] md:hidden" role="presentation">
            <button
              type="button"
              className="absolute inset-0 bg-black/50 animate-pp-backdrop-in"
              onClick={closeMobileFilters}
              aria-label="Close filters"
            />
            <div
              id="pp-mobile-filters-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="pp-mobile-filters-title"
              className="absolute bottom-0 left-0 right-0 flex max-h-[90vh] flex-col rounded-t-2xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-pp-sheet-up"
              style={
                sheetDragY > 0
                  ? { transform: `translateY(${sheetDragY}px)`, transition: "none" }
                  : undefined
              }
              onTouchStart={onSheetTouchStart}
              onTouchMove={onSheetTouchMove}
              onTouchEnd={onSheetTouchEnd}
            >
              <div className="flex shrink-0 flex-col items-center border-b border-gray-100 px-4 pt-2 pb-1">
                <div className="mb-2 h-1 w-10 rounded-full bg-gray-300" aria-hidden />
                <div className="flex w-full items-center justify-between py-2">
                  <h2 id="pp-mobile-filters-title" className="text-base font-bold uppercase tracking-wide text-gray-900">
                    Filters
                  </h2>
                  <button
                    type="button"
                    onClick={closeMobileFilters}
                    className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                    aria-label="Close filters"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
                <CategoryFiltersPanel showTitle={false} {...filterPanelProps} />
              </div>
              <div className="shrink-0 border-t border-gray-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={closeMobileFilters}
                  className="w-full rounded-lg bg-gray-900 py-3 text-sm font-semibold text-white"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <Footer />
    </div>
  )
}
