import { useQuery } from '@tanstack/react-query'
import { Laptop, Tablet, ClipboardList, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatUGX } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'
import SkeletonTable from '../components/SkeletonTable'

function StatCard({ icon: Icon, label, value, colour }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colour}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { profile } = useAuth()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [laptops, pdas, leases, overdue] = await Promise.all([
        supabase.from('assets').select('status', { count: 'exact' }).eq('asset_type', 'laptop'),
        supabase.from('assets').select('status', { count: 'exact' }).eq('asset_type', 'pda'),
        supabase.from('leases').select('total_cost_ugx').eq('status', 'active'),
        supabase.from('leases').select('id', { count: 'exact' }).eq('status', 'active').lt('end_date', new Date().toISOString().split('T')[0]),
      ])

      const laptopAvailable = laptops.data?.filter(a => a.status === 'available').length ?? 0
      const pdaAvailable = pdas.data?.filter(a => a.status === 'available').length ?? 0
      const activeLeases = leases.data?.length ?? 0
      const totalBilled = leases.data?.reduce((s, l) => s + Number(l.total_cost_ugx), 0) ?? 0

      return { laptopAvailable, pdaAvailable, activeLeases, overdue: overdue.count ?? 0, totalBilled }
    },
  })

  const { data: recentLeases, isLoading: loadingLeases } = useQuery({
    queryKey: ['recent-leases'],
    queryFn: async () => {
      const { data } = await supabase
        .from('leases')
        .select('id, start_date, end_date, status, total_cost_ugx, assets(asset_tag, asset_type, model), projects(project_name), users!leases_booked_by_id_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(8)
      return data ?? []
    },
  })

  return (
    <div className="space-y-6">
      <p className="text-gray-500 text-sm">Welcome back, <span className="font-medium text-gray-900">{profile?.full_name}</span></p>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Laptop} label="Laptops Available" value={stats?.laptopAvailable ?? 0} colour="bg-primary-600" />
          <StatCard icon={Tablet} label="PDAs Available" value={stats?.pdaAvailable ?? 0} colour="bg-emerald-500" />
          <StatCard icon={ClipboardList} label="Active Leases" value={stats?.activeLeases ?? 0} colour="bg-violet-500" />
          <StatCard icon={AlertTriangle} label="Overdue Leases" value={stats?.overdue ?? 0} colour="bg-red-500" />
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Leases</h2>
        </div>
        {loadingLeases ? (
          <div className="p-5"><SkeletonTable cols={5} rows={6} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="px-5 py-3 font-medium">Asset</th>
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Booked By</th>
                  <th className="px-5 py-3 font-medium">Period</th>
                  <th className="px-5 py-3 font-medium">Cost</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentLeases?.map((l, i) => (
                  <tr key={l.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{l.assets?.asset_tag}</p>
                      <p className="text-xs text-gray-400">{l.assets?.model}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-700">{l.projects?.project_name}</td>
                    <td className="px-5 py-3 text-gray-700">{l.users?.full_name}</td>
                    <td className="px-5 py-3 text-gray-600">{l.start_date} → {l.end_date}</td>
                    <td className="px-5 py-3 font-medium text-gray-900">{formatUGX(l.total_cost_ugx)}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${l.status === 'active' ? 'bg-blue-100 text-blue-800' : l.status === 'returned' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'}`}>
                        {l.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!recentLeases?.length && (
              <p className="text-sm text-gray-400 text-center py-10">No leases yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
