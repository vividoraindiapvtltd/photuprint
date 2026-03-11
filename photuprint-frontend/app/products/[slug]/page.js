import { notFound } from "next/navigation"
import { getProductBySlug, getProductSlugs } from "../../../src/lib/product-data"
import ProductDetailsClient from "../../../components/ProductDetailsClient"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://photuprint.com"

function stripHtml(html) {
  if (!html) return ""
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
}

function getImageUrl(product) {
  const img = product?.mainImage || product?.images?.[0]
  if (!img) return null
  if (img.startsWith("http")) return img
  return `${SITE_URL}${img}`
}

/** Pre-render top product slugs at build; rest generated on demand with revalidate 600. */
export async function generateStaticParams() {
  const slugs = await getProductSlugs(50)
  return slugs.map((slug) => ({ slug }))
}

export const revalidate = 600

export async function generateMetadata({ params }) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) {
    return { title: "Product Not Found" }
  }

  const productName = product.name || "Product"
  const rawDescription = stripHtml(product.description) || `Buy ${productName} online at the best price.`
  const description = rawDescription.length > 160 ? rawDescription.slice(0, 157) + "..." : rawDescription
  const imageUrl = getImageUrl(product)
  const productSlug = product.slug || slug
  const canonicalUrl = `${SITE_URL}/products/${encodeURIComponent(productSlug)}`
  const categoryName = product.category?.name || ""
  const price = product.discountedPrice || product.price

  return {
    title: `${productName}${categoryName ? ` | ${categoryName}` : ""} — PhotuPrint`,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: productName,
      description,
      url: canonicalUrl,
      type: "website",
      ...(imageUrl && {
        images: [{ url: imageUrl, width: 800, height: 800, alt: productName }],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: productName,
      description,
      ...(imageUrl && { images: [imageUrl] }),
    },
    ...(price && {
      other: {
        "product:price:amount": String(price),
        "product:price:currency": "INR",
      },
    }),
  }
}

function ProductJsonLd({ product }) {
  const imageUrl = getImageUrl(product)
  const price = product.discountedPrice || product.price

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(stripHtml(product.description) && { description: stripHtml(product.description) }),
    ...(imageUrl && { image: imageUrl }),
    ...(product.sku && { sku: product.sku }),
    ...(product.brand && {
      brand: { "@type": "Brand", name: typeof product.brand === "string" ? product.brand : product.brand?.name },
    }),
    ...(product.category?.name && { category: product.category.name }),
    ...(price && {
      offers: {
        "@type": "Offer",
        url: `${SITE_URL}/products/${encodeURIComponent(product.slug || product._id)}`,
        priceCurrency: "INR",
        price: String(price),
        availability: product.inStock === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
        ...(product.price && product.discountedPrice && product.price !== product.discountedPrice && {
          priceValidUntil: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        }),
      },
    }),
    ...(product.averageRating && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: String(product.averageRating),
        ...(product.reviewCount && { reviewCount: String(product.reviewCount) }),
      },
    }),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

export default async function ProductPage({ params }) {
  const { slug } = await params
  const product = await getProductBySlug(slug)

  if (!product) {
    notFound()
  }

  return (
    <>
      <ProductJsonLd product={product} />
      <ProductDetailsClient initialProduct={product} />
    </>
  )
}
