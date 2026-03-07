"use client"

import CategoryPage from "../../components/CategoryPage"

export default function CategorySlugClient({ categoryId, categoryName, initialProducts, initialSubcategories }) {
  return (
    <CategoryPage
      categoryId={categoryId}
      initialCategoryName={categoryName}
      initialProducts={initialProducts}
      initialSubcategories={initialSubcategories}
    />
  )
}
