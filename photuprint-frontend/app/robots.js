export default function robots() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://photuprint.com"
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/account", "/cart", "/checkout", "/thankyou", "/auth/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
