import { Suspense } from "react"
import HomePage from "../components/HomePage"
import { getHomepageData } from "../src/lib/homepage-data"
import { getFooterData } from "../src/lib/footer-data"
import { getCategoriesData } from "../src/lib/categories-data"

export const revalidate = 60

export const metadata = {
  title: "PhotuPrint — Custom Products & Photo Printing",
  description: "Shop custom products, phone covers, photo prints and personalized gifts. Premium quality with fast delivery across India.",
  alternates: { canonical: "/" },
}

function HomepageJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "PhotuPrint",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://photuprint.com",
    potentialAction: {
      "@type": "SearchAction",
      target: `${process.env.NEXT_PUBLIC_SITE_URL || "https://photuprint.com"}/products?search={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
}

export default async function Page() {
  const [homeData, footerData, categoriesData] = await Promise.all([getHomepageData(), getFooterData(), getCategoriesData()])

  return (
    <>
      <HomepageJsonLd />
      <Suspense>
        <HomePage initialSections={homeData.sections} fallbackProducts={homeData.fallbackProducts} initialFooterSections={footerData.sections} initialFooterTheme={footerData.theme} initialCategories={categoriesData} />
      </Suspense>
    </>
  )
}
