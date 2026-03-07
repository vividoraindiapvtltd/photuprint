import Link from "next/link";

/**
 * Product detail page: /product/[slug]
 * Fetch product via GET /api/products/by-slug/:slug (with X-Website-Id).
 */
export default async function ProductPage({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;
  // In production: fetch product by slug and render details
  // const product = await fetch(`${API_BASE}/api/products/by-slug/${slug}`, { headers: { 'X-Website-Id': websiteId } }).then(r => r.json());
  return (
    <div className="min-h-screen p-4">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold">Product: {slug}</h1>
        <p className="mt-2 text-gray-600">
          Product page using slug in URL (e.g. /product/my-product-slug).
        </p>
        <Link
          href={`/personalize/${slug}`}
          className="mt-4 inline-block rounded bg-black px-4 py-2 text-sm text-white"
        >
          Personalize this product
        </Link>
      </div>
    </div>
  );
}
