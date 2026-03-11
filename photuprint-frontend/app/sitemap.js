import { getCategories, getProductSlugs } from "../src/lib/product-data"

export default async function sitemap() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://photuprint.com"

  const staticPages = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/products`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
  ]

  let categoryPages = []
  try {
    const categories = await getCategories()
    categoryPages = categories
      .map((c) => {
        const slug = (c.slug || c.name || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
        if (!slug) return null
        return {
          url: `${siteUrl}/${encodeURIComponent(slug)}`,
          lastModified: new Date(c.updatedAt || Date.now()),
          changeFrequency: "weekly",
          priority: 0.7,
        }
      })
      .filter(Boolean)
  } catch {}

  let productPages = []
  try {
    const slugs = await getProductSlugs(200)
    productPages = slugs.map((slug) => ({
      url: `${siteUrl}/products/${encodeURIComponent(slug)}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    }))
  } catch {}

  return [...staticPages, ...categoryPages, ...productPages]
}
