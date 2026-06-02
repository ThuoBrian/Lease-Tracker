import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatUGX, formatDate } from '../lib/utils'
import { FINANCE_ROLES } from '../lib/constants'
import StatusBadge from '../components/StatusBadge'
import SkeletonTable from '../components/SkeletonTable'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'

export default function MyLeases() {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const canSeeAll = FINANCE_ROLES.includes(profile?.role) || profile?.role === 'project_manager'
  const today = format(new Date(), 'yyyy-MM-dd')

  const [returnLease, setReturnLease] = useState(null)
  const [returnDate, setReturnDate] = useState(today)
  const [statusFilter, setStatusFilter] = useState('')

  const { data: leases = [], isLoading } = useQuery({
    queryKey: ['leases', profile?.id, profile?.role],
    queryFn: async () => {
      let q = supabase
        .from('leases')
        .select('*, assets(asset_tag, asset_type, model), projects(project_name, project_code), users!leases_booked_by_id_fkey(full_name)')
        .order('created_at', { ascending: false })
      if (!canSeeAll) q = q.eq('booked_by_id', profile.id)
      else if (profile?.role === 'project_manager') {
        const { data: projs } = await supabase.from('projects').select('id').eq('budget_holder_id', profile.id)
        const ids = (projs ?? []).map(p => p.id)
        if (ids.length) q = q.in('project_id', ids)
      }
      const { data } = await q
      return data ?? []
    },
    enabled: !!profile,
  })

  const returnMutation = useMutation({
    mutationFn: async ({ leaseId, assetId, startDate, rate }) => {
      const { error } = await supabase.from('leases').update({
        status: 'returned',
        returned_date: returnDate,
        adjusted_cost_ugx: rate * (Math.floor((new Date(returnDate) - new Date(startDate)) / 86400000) + 1),
      }).eq('id', leaseId)
      if (error) throw error
      await supabase.from('assets').update({ status: 'available' }).eq('id', assetId)
    },
    onSuccess: () => { qc.invalidateQueries(['leases']); qc.invalidateQueries(['assets']); setReturnLease(null) },
  })

  const filtered = statusFilter ? leases.filter(l => l.status === statusFilter) : leases

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="returned">Returned</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-5"><SkeletonTable cols={7} rows={8} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No leases found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 font-medium">Asset</th>
                  <th className="px-5 py-3 font-medium">Project</th>
                  {canSeeAll && <th className="px-5 py-3 font-medium">Booked By</th>}
                  <th className="px-5 py-3 font-medium">Start</th>
                  <th className="px-5 py-3 font-medium">End</th>
                  <th className="px-5 py-3 font-medium">Cost</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l, i) => (
                  <tr key={l.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 !== 0 ? 'bg-gray-50/40' : ''}`}>
                    <td className="px-5 py-3">
                      <p className="font-medium">{l.assets?.asset_tag}</p>
                      <p className="text-xs text-gray-400">{l.assets?.asset_type?.toUpperCase()} · {l.assets?.model}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-700">{l.projects?.project_name}</td>
                    {canSeeAll && <td className="px-5 py-3 text-gray-600">{l.users?.full_name}</td>}
                    <td className="px-5 py-3 text-gray-600">{formatDate(l.start_date)}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {formatDate(l.end_date)}
                      {l.status === 'active' && l.end_date < today && <span className="ml-1 text-xs text-red-600 font-medium">OVERDUE</span>}
                    </td>
                    <td className="px-5 py-3 font-medium">{formatUGX(l.total_cost_ugx)}</td>
                    <td className="px-5 py-3"><StatusBadge value={l.status} /></td>
                    <td className="px-5 py-3">
                      {l.status === 'active' && (
                        <button onClick={() => { setReturnLease(l); setReturnDate(today) }}
                          className="text-xs px-2.5 py-1 border border-gray-300 rounded-lg hover:bg-gray-50">
                          Return
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {returnLease && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Return Lease</h3>
            <p className="text-sm text-gray-600">
              Returning <strong>{returnLease.assets?.asset_tag}</strong> for project <strong>{returnLease.projects?.project_name}</strong>.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Return Date</label>
              <input type="date" value={returnDate} min={returnLease.start_date} max={today}
                onChange={e => setReturnDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
              <p className="text-gray-600">Adjusted Cost: <span className="font-medium text-gray-900">
                {formatUGX(Number(returnLease.daily_rate_ugx) * (Math.floor((new Date(returnDate) - new Date(returnLease.start_date)) / 86400000) + 1))}
              </span></p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setReturnLease(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => returnMutation.mutate({ leaseId: returnLease.id, assetId: returnLease.asset_id, startDate: returnLease.start_date, rate: Number(returnLease.daily_rate_ugx) })}
                disabled={returnMutation.isPending}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60">
                {returnMutation.isPending ? 'Returning…' : 'Confirm Return'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
