"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"

function resolveImageUrl(url) {
  if (!url) return ""
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  const base = typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, "") : ""
  return base + (url.startsWith("/") ? url : "/" + url)
}

/** Shimmer for Ads Banner Carousel — same layout/size as carousel to avoid CLS */
function BannerCarouselShimmer() {
  return (
    <section className="w-full bg-gray-200" aria-hidden="true">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="relative overflow-hidden rounded-xl" style={{ paddingBottom: "2.5rem" }}>
          {/* Main banner area — matches carousel minHeight 320px */}
          <div className="w-full rounded-xl bg-gray-300 animate-pulse" style={{ minHeight: "512px" }} />
        </div>
      </div>
    </section>
  )
}

export default function Carousel({ carouselKey = "hero" }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({
    slides: [],
    layout: "fullWidth",
    name: "",
    slideEffect: "fade",
    isActive: true,
    autoplay: true,
    autoplayInterval: 5,
    transitionDuration: 0.5,
    loop: true,
    showArrows: true,
    arrowsPosition: "inside",
    showDots: true,
    dotsOutside: false,
    pauseOnHover: true,
    showSlideTitle: true,
    showSlideSubtitle: true,
    captionPosition: "overlay",
    imageFit: "cover",
    showDisplayName: true,
    backgroundColor: "#111827",
    displayNameColor: "#ffffff",
    displayNameFontSize: "20px",
    captionColor: "#ffffff",
    captionSubtitleColor: "#e5e7eb",
    captionTitleFontSize: "18px",
    captionSubtitleFontSize: "14px",
    captionOverlayOpacity: 0.8,
  })
  const [pageIndex, setPageIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const autoplayRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    const url = carouselKey ? `/api/carousel?key=${encodeURIComponent(carouselKey)}` : "/api/carousel"
    fetch(url, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        setData({
          slides: json.slides || [],
          layout: json.layout || "fullWidth",
          name: json.name ?? "",
          slideEffect: json.slideEffect || "fade",
          isActive: json.isActive !== false,
          autoplay: json.autoplay !== false,
          autoplayInterval: Math.max(1, Math.min(60, Number(json.autoplayInterval) || 5)),
          transitionDuration: Math.max(0.2, Math.min(2, Number(json.transitionDuration) || 0.5)),
          loop: json.loop !== false,
          showArrows: json.showArrows !== false,
          arrowsPosition: json.arrowsPosition || "inside",
          showDots: json.showDots !== false,
          dotsOutside: !!json.dotsOutside,
          pauseOnHover: json.pauseOnHover !== false,
          showSlideTitle: json.showSlideTitle !== false,
          showSlideSubtitle: json.showSlideSubtitle !== false,
          captionPosition: json.captionPosition || "overlay",
          imageFit: json.imageFit || "cover",
          showDisplayName: json.showDisplayName !== false,
          backgroundColor: json.backgroundColor || "#111827",
          displayNameColor: json.displayNameColor || "#ffffff",
          displayNameFontSize: json.displayNameFontSize || "20px",
          captionColor: json.captionColor || "#ffffff",
          captionSubtitleColor: json.captionSubtitleColor || "#e5e7eb",
          captionTitleFontSize: json.captionTitleFontSize || "18px",
          captionSubtitleFontSize: json.captionSubtitleFontSize || "14px",
          captionOverlayOpacity: Math.max(0, Math.min(1, Number(json.captionOverlayOpacity) ?? 0.8)),
        })
        setPageIndex(0)
      })
      .catch(() => setData((p) => ({ ...p, slides: [] })))
      .finally(() => setLoading(false))
  }, [carouselKey])

  const { slides, layout, name, slideEffect, isActive, autoplay, autoplayInterval, transitionDuration, loop, showArrows, arrowsPosition, showDots, dotsOutside, pauseOnHover, showSlideTitle, showSlideSubtitle, captionPosition, imageFit, showDisplayName, backgroundColor, displayNameColor, displayNameFontSize, captionColor, captionSubtitleColor, captionTitleFontSize, captionSubtitleFontSize, captionOverlayOpacity } = data

  const perPage = layout === "fullWidth" ? 1 : layout === "cards2" ? 2 : layout === "cards3" ? 3 : 4
  const pageCount = layout === "fullWidth" ? slides.length : Math.ceil(slides.length / perPage) || 0

  const goPrev = useCallback(() => {
    setPageIndex((i) => {
      if (loop) return (i - 1 + pageCount) % pageCount
      return Math.max(0, i - 1)
    })
  }, [pageCount, loop])

  const goNext = useCallback(() => {
    setPageIndex((i) => {
      if (loop) return (i + 1) % pageCount
      return Math.min(pageCount - 1, i + 1)
    })
  }, [pageCount, loop])

  useEffect(() => {
    if (pageCount <= 1 || !autoplay || isPaused) return
    const ms = autoplayInterval * 1000
    autoplayRef.current = setInterval(goNext, ms)
    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current)
    }
  }, [pageCount, autoplay, autoplayInterval, isPaused, goNext])

  if (loading) return <BannerCarouselShimmer />
  if (!isActive || slides.length === 0) return null

  const currentSlides = layout === "fullWidth" ? [slides[pageIndex]] : slides.slice(pageIndex * perPage, pageIndex * perPage + perPage)

  const handleMouseEnter = () => {
    if (pauseOnHover) setIsPaused(true)
  }
  const handleMouseLeave = () => {
    if (pauseOnHover) setIsPaused(false)
  }

  const showCaption = (slide) => (showSlideTitle && slide.title) || (showSlideSubtitle && slide.subtitle)
  const transitionMs = Math.round(transitionDuration * 1000)
  const imgFit = imageFit === "contain" ? "bg-contain" : "bg-cover"
  const displayNameStyle = { fontSize: displayNameFontSize || "20px", color: displayNameColor || "#ffffff" }
  const captionTitleStyle = { fontSize: captionTitleFontSize || "18px", color: captionColor || "#ffffff" }
  const captionSubtitleStyle = { fontSize: captionSubtitleFontSize || "14px", color: captionSubtitleColor || "#e5e7eb" }
  const overlayBg = `linear-gradient(to top, rgba(0,0,0,${captionOverlayOpacity ?? 0.8}), transparent)`

  const Caption = ({ slide, fullWidth }) => {
    if (!showCaption(slide)) return null
    const content = (
      <>
        {showSlideTitle && slide.title && (
          <div className="font-semibold mt-0" style={captionTitleStyle}>
            {slide.title}
          </div>
        )}
        {showSlideSubtitle && slide.subtitle && (
          <div className="mt-1" style={captionSubtitleStyle}>
            {slide.subtitle}
          </div>
        )}
      </>
    )
    if (captionPosition === "below") {
      return (
        <div className={fullWidth ? "p-4 rounded-b-xl" : "p-3 rounded-b-lg"} style={{ backgroundColor: `rgba(0,0,0,${captionOverlayOpacity ?? 0.8})` }}>
          {content}
        </div>
      )
    }
    return (
      <div className={fullWidth ? "absolute inset-x-0 bottom-0 p-6 rounded-b-xl" : "absolute inset-x-0 bottom-0 p-3 rounded-b-lg"} style={{ background: overlayBg }}>
        {content}
      </div>
    )
  }

  return (
    <section className="w-full" style={{ backgroundColor: backgroundColor || "#111827" }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="relative overflow-hidden rounded-xl" style={{ paddingBottom: dotsOutside && showDots && pageCount > 1 ? "2.5rem" : 0 }}>
          {layout === "fullWidth" ? (
            <div className="relative w-full overflow-hidden" style={{ minHeight: "512px" }}>
              {slideEffect === "slide" ? (
                <div
                  className="flex transition-transform ease-out"
                  style={{ transitionDuration: `${transitionMs}ms` }}
                  style={{
                    width: `${slides.length * 100}%`,
                    transform: `translateX(-${(pageIndex / slides.length) * 100}%)`,
                  }}
                >
                  {slides.map((slide) => (
                    <div key={slide._id} className="flex-shrink-0 relative" style={{ width: `${100 / slides.length}%` }}>
                      <SlideLink slide={slide} fullWidth>
                        <div
                          className={`w-full ${imgFit} bg-center rounded-xl`}
                          style={{
                            height: "512px",
                            backgroundImage: `url(${resolveImageUrl(slide.imageUrl)})`,
                          }}
                        />
                        <Caption slide={slide} fullWidth />
                      </SlideLink>
                    </div>
                  ))}
                </div>
              ) : slideEffect === "zoom" ? (
                <>
                  {slides.map((slide, idx) => (
                    <div
                      key={slide._id}
                      className="absolute inset-0 transition-all ease-out"
                      style={{
                        opacity: idx === pageIndex ? 1 : 0,
                        transform: idx === pageIndex ? "scale(1)" : "scale(0.9)",
                        pointerEvents: idx === pageIndex ? "auto" : "none",
                        transitionDuration: `${transitionMs}ms`,
                      }}
                    >
                      <SlideLink slide={slide} fullWidth>
                        <div
                          className={`w-full ${imgFit} bg-center rounded-xl`}
                          style={{
                            height: "512px",
                            backgroundImage: `url(${resolveImageUrl(slide.imageUrl)})`,
                          }}
                        />
                        <Caption slide={slide} fullWidth />
                      </SlideLink>
                    </div>
                  ))}
                </>
              ) : slideEffect === "slideUp" ? (
                <div className="overflow-hidden" style={{ height: "512px" }}>
                  <div
                    className="flex flex-col transition-transform ease-out"
                    style={{
                      height: `${slides.length * 512}px`,
                      transform: `translateY(-${pageIndex * 512}px)`,
                      transitionDuration: `${transitionMs}ms`,
                    }}
                  >
                    {slides.map((slide) => (
                      <div key={slide._id} className="flex-shrink-0 relative" style={{ height: "512px" }}>
                        <SlideLink slide={slide} fullWidth>
                          <div
                            className={`w-full h-full ${imgFit} bg-center rounded-xl`}
                            style={{
                              height: "512px",
                              backgroundImage: `url(${resolveImageUrl(slide.imageUrl)})`,
                            }}
                          />
                          <Caption slide={slide} fullWidth />
                        </SlideLink>
                      </div>
                    ))}
                  </div>
                </div>
              ) : slideEffect === "flip" ? (
                <div style={{ perspective: "1200px", height: "512px" }}>
                  {slides.map((slide, idx) => (
                    <div
                      key={slide._id}
                      className="absolute inset-0 transition-all ease-in-out"
                      style={{
                        opacity: idx === pageIndex ? 1 : 0,
                        transform: idx === pageIndex ? "rotateY(0deg)" : "rotateY(90deg)",
                        transformStyle: "preserve-3d",
                        pointerEvents: idx === pageIndex ? "auto" : "none",
                        transitionDuration: `${transitionMs}ms`,
                      }}
                    >
                      <SlideLink slide={slide} fullWidth>
                        <div
                          className={`w-full ${imgFit} bg-center rounded-xl`}
                          style={{
                            height: "512px",
                            backgroundImage: `url(${resolveImageUrl(slide.imageUrl)})`,
                          }}
                        />
                        <Caption slide={slide} fullWidth />
                      </SlideLink>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {slides.map((slide, idx) => (
                    <div
                      key={slide._id}
                      className="absolute inset-0 transition-opacity ease-in-out"
                      style={{
                        opacity: idx === pageIndex ? 1 : 0,
                        pointerEvents: idx === pageIndex ? "auto" : "none",
                        transitionDuration: `${transitionMs}ms`,
                      }}
                    >
                      <SlideLink slide={slide} fullWidth>
                        <div
                          className={`w-full ${imgFit} bg-center rounded-xl`}
                          style={{
                            height: "512px",
                            backgroundImage: `url(${resolveImageUrl(slide.imageUrl)})`,
                          }}
                        />
                        <Caption slide={slide} fullWidth />
                      </SlideLink>
                    </div>
                  ))}
                </>
              )}
            </div>
          ) : (
            <div className={`grid gap-4 py-2 grid-cols-1 ${perPage >= 2 ? "md:grid-cols-2" : ""} ${perPage >= 3 ? "lg:grid-cols-3" : ""} ${perPage >= 4 ? "xl:grid-cols-4" : ""}`}>
              {currentSlides.map((slide) => (
                <SlideLink key={slide._id} slide={slide}>
                  <div className="relative block rounded-lg overflow-hidden bg-white/5">
                    <div
                      className={`w-full ${imgFit} bg-center rounded-t-lg aspect-[4/3]`}
                      style={{
                        backgroundImage: `url(${resolveImageUrl(slide.imageUrl)})`,
                      }}
                    />
                    <Caption slide={slide} fullWidth={false} />
                  </div>
                </SlideLink>
              ))}
            </div>
          )}

          {pageCount > 1 && (
            <>
              {showArrows && (
                <>
                  <button type="button" onClick={goPrev} className="absolute top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-gray-800 flex items-center justify-center shadow-lg transition-colors z-10" style={{ left: arrowsPosition === "outside" ? "-1.25rem" : "0.5rem" }} aria-label="Previous">
                    ‹
                  </button>
                  <button type="button" onClick={goNext} className="absolute top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-gray-800 flex items-center justify-center shadow-lg transition-colors z-10" style={{ right: arrowsPosition === "outside" ? "-1.25rem" : "0.5rem" }} aria-label="Next">
                    ›
                  </button>
                </>
              )}
              {showDots && (
                <div className="absolute left-1/2 -translate-x-1/2 flex gap-2 z-10" style={{ bottom: dotsOutside ? "-2rem" : "0.75rem" }}>
                  {Array.from({ length: pageCount }, (_, i) => (
                    <button key={i} type="button" onClick={() => setPageIndex(i)} className={`w-2.5 h-2.5 rounded-full border-0 transition-colors ${i === pageIndex ? "bg-white" : "bg-white/50 hover:bg-white/70"}`} aria-label={`Go to slide ${i + 1}`} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function SlideLink({ slide, children, fullWidth }) {
  const href = slide.linkUrl || "#"
  const isExternal = slide.openInNewTab
  const content = <div className={fullWidth ? "block relative w-full" : "block rounded-lg overflow-hidden bg-white/5"}>{children}</div>
  if (!slide.linkUrl || slide.linkUrl === "#") {
    return <div className="cursor-default">{content}</div>
  }
  return (
    <Link href={href} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noopener noreferrer" : undefined} className="block">
      {content}
    </Link>
  )
}
