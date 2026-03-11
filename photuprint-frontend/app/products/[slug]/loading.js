export default function ProductLoading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      <div className="h-10 bg-gray-800" />
      <div className="h-16 bg-white border-b border-gray-200" />
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-1/2">
            <div className="aspect-square bg-gray-200 rounded-xl" />
            <div className="flex gap-2 mt-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-16 h-16 bg-gray-200 rounded" />
              ))}
            </div>
          </div>
          <div className="lg:w-1/2 space-y-4">
            <div className="h-8 bg-gray-200 rounded w-3/4" />
            <div className="h-6 bg-gray-200 rounded w-1/4" />
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-5/6" />
            <div className="h-4 bg-gray-200 rounded w-2/3" />
            <div className="h-12 bg-gray-200 rounded w-1/2 mt-6" />
          </div>
        </div>
      </div>
    </div>
  )
}
