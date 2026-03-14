/** @type {import('next').NextConfig} */
const path = require("path")

const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
})

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  compress: true,

  // fabric.js has Node.js bindings that break webpack; exclude from server bundling
  serverExternalPackages: ["fabric", "canvas"],

  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },

  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api",
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.REACT_APP_GOOGLE_CLIENT_ID,
    NEXT_PUBLIC_WEBSITE_ID: process.env.NEXT_PUBLIC_WEBSITE_ID,
  },

  async rewrites() {
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api").replace(/\/api\/?$/, "") || "http://localhost:8080"
    return {
      afterFiles: [
        {
          source: "/api/:path*",
          destination: `${apiBase}/api/:path*`,
        },
        // Proxy uploads so variant/color images load from same origin
        {
          source: "/uploads/:path*",
          destination: `${apiBase}/uploads/:path*`,
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

  webpack: (config, { dev, isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname, "src"),
      // Force browser build of fabric (avoids Node.js .node bindings that break client bundle)
      ...(isServer ? {} : { fabric: path.resolve(__dirname, "node_modules/fabric/dist/index.min.mjs") }),
    }
    // Disable webpack file cache in dev to avoid ENOENT/rename errors (e.g. when .next is cleared while running)
    if (dev) {
      config.cache = false
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
