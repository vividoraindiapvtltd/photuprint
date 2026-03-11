export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      <div className="h-10 bg-gray-800" />
      <div className="h-16 bg-white border-b border-gray-200" />
      <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
        <div className="w-full rounded-xl bg-gray-200" style={{ height: "512px" }} />
      </div>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="h-6 w-40 bg-gray-200 rounded mx-auto mb-8" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-gray-100 bg-white">
              <div className="aspect-square bg-gray-200" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-4/5" />
                <div className="h-4 bg-gray-200 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
