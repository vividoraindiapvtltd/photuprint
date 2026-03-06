import Link from "next/link";

export default function AdminTemplatesPage() {
  // In production: fetch templates + thumbnails (paged) from API
  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Templates</h1>
        <Link
          href="/templates/new/edit"
          className="rounded bg-black px-4 py-2 text-white"
        >
          New template
        </Link>
      </div>

      <p className="mt-2 text-sm text-gray-600">
        List view should show thumbnails, status (draft/published), product mappings, and filters.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {["tmpl_1", "tmpl_2", "tmpl_3"].map((id) => (
          <Link
            key={id}
            href={`/templates/${id}/edit`}
            className="rounded border p-4 hover:bg-gray-50"
          >
            <div className="h-40 w-full rounded bg-gray-200" />
            <div className="mt-3 flex items-center justify-between">
              <div className="font-medium">{id}</div>
              <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">
                published
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

