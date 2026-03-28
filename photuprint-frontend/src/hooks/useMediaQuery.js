"use client"

import { useSyncExternalStore, useState, useLayoutEffect } from "react"

/**
 * Subscribes to `window.matchMedia`. Server snapshot and the first client render
 * stay `false` (mobile-first) until after mount so SSR HTML matches hydration.
 * Then the real match is applied (useLayoutEffect) to minimize layout flash.
 */
export function useMediaQuery(query) {
  const [mounted, setMounted] = useState(false)
  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  const matches = useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined") return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    },
    () => (typeof window !== "undefined" ? window.matchMedia(query).matches : false),
    () => false,
  )

  if (!mounted) return false
  return matches
}
