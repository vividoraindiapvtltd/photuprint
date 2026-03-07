"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "../../src/context/AuthContext"

function LoginRedirect() {
  const { isAuthenticated, openLoginModal } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get("from") || "/"

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(from)
      return
    }
    openLoginModal(from)
    router.replace("/")
  }, [isAuthenticated, from, openLoginModal, router])

  return null
}

export default function Login() {
  return (
    <Suspense fallback={null}>
      <LoginRedirect />
    </Suspense>
  )
}
