import { notFound } from "next/navigation"
import { getCategories, getCategoryBySlug, getProductsByCategory, getSubcategories } from "../../src/lib/product-data"
import CategorySlugClient from "./CategorySlugClient"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://photuprint.com"

const RESERVED_PATHS = new Set(["products", "product", "account", "login", "register", "review", "api", "admin", "_next", "favicon.ico"])

/** Pre-render top category slugs at build; revalidate every 300s (ISR). */
export async function generateStaticParams() {
  const categories = await getCategories()
  const slugs = categories
    .slice(0, 100)
    .map((c) => {
      const slug = (
        c.slug ||
        (c.name || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "") ||
        ""
      ).toLowerCase()
      return slug
    })
    .filter((s) => s && !RESERVED_PATHS.has(s))
  return slugs.map((categorySlug) => ({ categorySlug }))
}

export const revalidate = 300

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

  const [products, subcategories] = await Promise.all([getProductsByCategory(category.id), getSubcategories(category.id)])

  return <CategorySlugClient categoryId={category.id} categoryName={category.name} initialProducts={products} initialSubcategories={subcategories} />
}
