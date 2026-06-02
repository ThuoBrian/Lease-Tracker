const COLOURS = {
  available: 'bg-green-100 text-green-800',
  leased: 'bg-amber-100 text-amber-800',
  maintenance: 'bg-red-100 text-red-800',
  active: 'bg-blue-100 text-blue-800',
  returned: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
  good: 'bg-green-100 text-green-700',
  fair: 'bg-yellow-100 text-yellow-800',
  poor: 'bg-red-100 text-red-700',
}

export default function StatusBadge({ value, label }) {
  const colour = COLOURS[value] ?? 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colour}`}>
      {label ?? value}
    </span>
  )
}
