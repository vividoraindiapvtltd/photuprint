"use client"

import { useCallback, useRef } from "react"

const CART_ICON_SELECTOR = "[data-cart-icon]"
const ANIMATION_DURATION = 700
const EASING = "cubic-bezier(0.25, 0.46, 0.45, 0.94)"

function getImageBase() {
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api"
  return api.replace(/\/api\/?$/, "") || "http://localhost:8080"
}

function resolveImageUrl(url) {
  if (!url) return ""
  return url.startsWith("http") ? url : `${getImageBase()}${url}`
}

/**
 * Fly-to-cart animation: clones product image and animates it to the cart icon.
 * @param {Object} options
 * @param {() => void} [options.onComplete] - Called when animation finishes
 * @returns {(imageUrl: string, sourceRect: DOMRect) => void} runFlyToCart
 */
export function useFlyToCart({ onComplete } = {}) {
  const animatingRef = useRef(false)

  const runFlyToCart = useCallback(
    (imageUrl, sourceRect) => {
      if (animatingRef.current) return
      if (!imageUrl || !sourceRect || typeof document === "undefined") {
        onComplete?.()
        return
      }

      const cartEl = document.querySelector(CART_ICON_SELECTOR)
      if (!cartEl) {
        onComplete?.()
        return
      }

      const cartRect = cartEl.getBoundingClientRect()
      const src = resolveImageUrl(imageUrl)

      animatingRef.current = true

      const fly = document.createElement("div")
      fly.setAttribute("data-fly-to-cart", "true")
      fly.style.cssText = `
        position: fixed;
        z-index: 9999;
        pointer-events: none;
        left: ${sourceRect.left}px;
        top: ${sourceRect.top}px;
        width: ${sourceRect.width}px;
        height: ${sourceRect.height}px;
        transition: none;
      `
      const img = document.createElement("img")
      img.src = src
      img.alt = ""
      img.style.cssText = "width: 100%; height: 100%; object-fit: contain; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);"
      fly.appendChild(img)
      document.body.appendChild(fly)

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const endX = cartRect.left + cartRect.width / 2
          const endY = cartRect.top + cartRect.height / 2
          const startX = sourceRect.left + sourceRect.width / 2
          const startY = sourceRect.top + sourceRect.height / 2
          const scaleEnd = 0.2
          const translateX = endX - startX
          const translateY = endY - startY

          fly.style.transition = `transform ${ANIMATION_DURATION}ms ${EASING}, opacity ${ANIMATION_DURATION}ms ${EASING}`
          fly.style.left = `${startX}px`
          fly.style.top = `${startY}px`
          fly.style.width = `${sourceRect.width}px`
          fly.style.height = `${sourceRect.height}px`
          fly.style.transform = `translate(-50%, -50%) scale(1)`
          fly.style.opacity = "1"

          requestAnimationFrame(() => {
            fly.style.transform = `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px)) scale(${scaleEnd})`
            fly.style.opacity = "0"
          })
        })
      })

      const cleanup = () => {
        fly.remove()
        animatingRef.current = false
        document.dispatchEvent(new CustomEvent("cart-shake"))
        onComplete?.()
      }

      setTimeout(cleanup, ANIMATION_DURATION)
    },
    [onComplete],
  )

  return runFlyToCart
}
