import { notFound } from "next/navigation"
import { getCategoryBySlug, getProductsByCategory, getSubcategories } from "../../src/lib/product-data"
import CategorySlugClient from "./CategorySlugClient"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://photuprint.com"

const RESERVED_PATHS = new Set([
  "products",
  "product",
  "account",
  "login",
  "register",
  "review",
  "api",
  "admin",
  "_next",
  "favicon.ico",
])

export async function generateMetadata({ params }) {
  const { categorySlug } = await params
  if (!categorySlug || RESERVED_PATHS.has(categorySlug.toLowerCase())) {
    return { title: "Page Not Found" }
  }

  const category = await getCategoryBySlug(categorySlug)
  if (!category) {
    return { title: "Category Not Found" }
  }

  const title = `${category.name} — Shop Online | PhotuPrint`
  const description = `Browse our ${category.name} collection. Customize and order online with the best quality and fast delivery.`
  const canonicalUrl = `${SITE_URL}/${encodeURIComponent(categorySlug)}`

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "website",
    },
    twitter: { card: "summary", title, description },
  }
}

export default async function CategoryBySlugPage({ params }) {
  const { categorySlug } = await params
  if (!categorySlug || RESERVED_PATHS.has(categorySlug.toLowerCase())) {
    notFound()
  }

  const category = await getCategoryBySlug(categorySlug)
  if (!category) {
    notFound()
  }

  const [products, subcategories] = await Promise.all([
    getProductsByCategory(category.id),
    getSubcategories(category.id),
  ])

  return (
    <CategorySlugClient
      categoryId={category.id}
      categoryName={category.name}
      initialProducts={products}
      initialSubcategories={subcategories}
    />
  )
}
