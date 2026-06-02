export default function SkeletonTable({ cols = 6, rows = 8 }) {
  return (
    <div className="animate-pulse">
      <div className="h-10 bg-gray-200 rounded mb-2" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 mb-2">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-8 bg-gray-100 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}
