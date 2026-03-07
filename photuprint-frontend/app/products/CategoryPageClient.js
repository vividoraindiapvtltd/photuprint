"use client"

import CategoryPage from "../../components/CategoryPage"

export default function CategoryPageClient({ categoryId, initialCategoryName, initialProducts }) {
  return (
    <CategoryPage
      categoryId={categoryId}
      initialCategoryName={initialCategoryName}
      initialProducts={initialProducts}
    />
  )
}
