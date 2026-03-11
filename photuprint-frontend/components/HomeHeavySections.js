"use client"

import dynamic from "next/dynamic"

function BannerCarouselShimmer() {
  return (
    <section className="w-full bg-gray-200" aria-hidden="true">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="relative overflow-hidden rounded-xl">
          <div className="w-full rounded-xl bg-gray-300 animate-pulse" style={{ minHeight: "512px" }} />
        </div>
      </div>
    </section>
  )
}

function CategoriesShimmer() {
  return (
    <section className="bg-white py-10 border-b border-gray-200" aria-hidden="true">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mx-auto mb-8" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-gray-100 bg-white">
              <div className="aspect-square bg-gray-200 animate-pulse" />
              <div className="p-3"><div className="h-4 bg-gray-200 rounded animate-pulse w-3/4 mx-auto" /></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const Carousel = dynamic(() => import("./Carousel"), {
  loading: () => <BannerCarouselShimmer />,
  ssr: false,
})
const CategoriesSection = dynamic(() => import("./CategoriesSection"), {
  loading: () => <CategoriesShimmer />,
  ssr: false,
})
const TestimonialsCarousel = dynamic(() => import("./TestimonialsCarousel"), { ssr: false })
const RecentlyViewedProducts = dynamic(
  () => import("./FeaturedProductSection").then((m) => ({ default: m.RecentlyViewedProducts })),
  { ssr: false },
)
const SubscribeOverlay = dynamic(() => import("./SubscribeOverlay"), { ssr: false })

export default function HomeHeavySections() {
  return (
    <>
      <SubscribeOverlay />
      <Carousel />
      <CategoriesSection />
      <TestimonialsCarousel />
      <RecentlyViewedProducts />
    </>
  )
}
