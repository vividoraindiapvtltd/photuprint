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

const Carousel = dynamic(() => import("./Carousel"), {
  loading: () => <BannerCarouselShimmer />,
})
const TestimonialsCarousel = dynamic(() => import("./TestimonialsCarousel"))
const RecentlyViewedProducts = dynamic(() => import("./FeaturedProductSection").then((m) => ({ default: m.RecentlyViewedProducts })))
const SubscribeOverlay = dynamic(() => import("./SubscribeOverlay"))

export default function HomeHeavySections({ children }) {
  return (
    <>
      <SubscribeOverlay />
      <Carousel />
      {children}
      <TestimonialsCarousel />
      <RecentlyViewedProducts />
    </>
  )
}
