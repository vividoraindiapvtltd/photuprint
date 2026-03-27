/** @type {import('next').NextConfig} */
const path = require("path")

/**
 * Google reCAPTCHA v2 global test keys (always pass verification; OK for localhost).
 * https://developers.google.com/recaptcha/docs/faq
 *
 * Production site keys (e.g. in .env.production) are domain-locked and show
 * "Localhost is not in the list of supported domains" during `npm run dev` if they
 * end up in process.env. We override in development unless opted out.
 */
const RECAPTCHA_V2_TEST_SITE_KEY = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
const RECAPTCHA_V2_TEST_SECRET_KEY = "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe"

const useRecaptchaTestKeysInDev =
  process.env.NODE_ENV === "development" &&
  process.env.RECAPTCHA_USE_PRODUCTION_IN_DEV !== "true"

if (useRecaptchaTestKeysInDev) {
  process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = RECAPTCHA_V2_TEST_SITE_KEY
  process.env.RECAPTCHA_SECRET_KEY = RECAPTCHA_V2_TEST_SECRET_KEY
}

const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
})

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  compress: true,

<<<<<<< Updated upstream
=======
  // Silence "multiple lockfiles" warning — use photuprint-frontend as the trace root
  outputFileTracingRoot: path.join(__dirname),

  // Allow dev requests from 127.0.0.1 (e.g. when accessing via IP)
  allowedDevOrigins: ["127.0.0.1", "localhost"],

>>>>>>> Stashed changes
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },

  env: {
    ...(useRecaptchaTestKeysInDev
      ? { NEXT_PUBLIC_RECAPTCHA_SITE_KEY: RECAPTCHA_V2_TEST_SITE_KEY }
      : {}),
  },

  async rewrites() {
<<<<<<< Updated upstream
=======
    // Use API_URL (server-only) so /api/* is proxied to the real backend. Client never sees
    // admin.photuprint.com; all requests in Network tab stay on the frontend origin (e.g. testing.photuprint.com).
    const backendOrigin = process.env.API_URL
      ? process.env.API_URL.replace(/\/api\/?$/, "")
      : "http://127.0.0.1:8080"
>>>>>>> Stashed changes
    return {
      afterFiles: [
        {
          source: "/api/:path*",
<<<<<<< Updated upstream
          destination: "http://localhost:8080/api/:path*",
=======
          destination: `${backendOrigin}/api/:path*`,
        },
        {
          source: "/uploads/:path*",
          destination: `${backendOrigin}/uploads/:path*`,
>>>>>>> Stashed changes
        },
      ],
    }
  },

  async headers() {
    return [
      {
        source: "/:all*(svg|jpg|jpeg|png|webp|avif|ico|woff|woff2)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ]
  },

  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname, "src"),
    }

    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            vendor: {
              test: /[\\/]node_modules[\\/](axios|isomorphic-dompurify|dompurify)[\\/]/,
              name: "vendor-lib",
              chunks: "all",
              priority: 20,
            },
          },
        },
      }
    }

    return config
  },

  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8080",
        pathname: "/uploads/**",
      },
      {
        protocol: "http",
        hostname: "testing.photuprint.com",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "testing.photuprint.com",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "admin.photuprint.com",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
    unoptimized: false,
  },
}

module.exports = withBundleAnalyzer(nextConfig)

