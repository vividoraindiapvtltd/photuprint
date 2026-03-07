import { getProductsByCategory, getCategories } from "../../src/lib/product-data"
import CategoryPageClient from "./CategoryPageClient"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://photuprint.com"

export async function generateMetadata({ searchParams }) {
  const sp = await searchParams
  const categoryName = sp?.categoryName
  const title = categoryName
    ? `${categoryName} — Shop Online | PhotuPrint`
    : "All Products — Shop Online | PhotuPrint"
  const description = categoryName
    ? `Browse our collection of ${categoryName}. Customize and order online with fast delivery.`
    : "Explore our full range of customizable products. Order online with fast delivery."

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/products` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/products`,
      type: "website",
    },
    twitter: { card: "summary", title, description },
  }
}

export default async function ProductsPage({ searchParams }) {
  const sp = await searchParams
  const categoryId = sp?.categoryId || sp?.category || null
  const categoryName = sp?.categoryName || null

  const [products, categories] = await Promise.all([
    getProductsByCategory(categoryId),
    categoryId ? Promise.resolve([]) : getCategories(),
  ])

  return (
    <CategoryPageClient
      categoryId={categoryId}
      initialCategoryName={categoryName}
      initialProducts={products}
    />
  )
}
