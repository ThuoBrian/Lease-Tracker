import { PackageOpen } from 'lucide-react'

export default function EmptyState({ title = 'No data found', description = '' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <PackageOpen className="w-12 h-12 mb-4 text-gray-300" />
      <p className="text-base font-medium text-gray-500">{title}</p>
      {description && <p className="text-sm mt-1">{description}</p>}
    </div>
  )
}
