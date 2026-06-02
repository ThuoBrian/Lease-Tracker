import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, differenceInDays, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatUGX, formatDate, calcDepreciation, downloadCSV, downloadPDF } from '../lib/utils'
import { DEFAULT_USEFUL_LIFE } from '../lib/constants'
import SkeletonTable from '../components/SkeletonTable'
import EmptyState from '../components/EmptyState'

const TABS = ['Lease Summary', 'Asset Utilization', 'Project Billing', 'Depreciation']

export default function Reports() {
  const { profile } = useAuth()
  const isFinance = ['admin', 'finance'].includes(profile?.role)
  const [tab, setTab] = useState(0)
  const today = format(new Date(), 'yyyy-MM-dd')
  const monthStart = format(new Date(), 'yyyy-MM-01')

  const [filters, setFilters] = useState({ dateFrom: monthStart, dateTo: today, assetType: '', projectId: '', status: '' })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, project_name, project_code').order('project_name')
      return data ?? []
    },
  })

  const { data: leaseSummary = [], isLoading: l1 } = useQuery({
    queryKey: ['report-leases', filters],
    enabled: tab === 0,
    queryFn: async () => {
      let q = supabase.from('leases')
        .select('*, assets(asset_tag, asset_type, model), projects(project_name, project_code), users!leases_booked_by_id_fkey(full_name)')
        .gte('start_date', filters.dateFrom)
        .lte('start_date', filters.dateTo)
      if (filters.assetType) q = q.eq('assets.asset_type', filters.assetType)
      if (filters.projectId) q = q.eq('project_id', filters.projectId)
      if (filters.status) q = q.eq('status', filters.status)
      const { data } = await q.order('start_date', { ascending: false })
      return data ?? []
    },
  })

  const { data: utilization = [], isLoading: l2 } = useQuery({
    queryKey: ['report-utilization', filters],
    enabled: tab === 1,
    queryFn: async () => {
      const { data: assets } = await supabase.from('assets').select('id, asset_tag, asset_type, model, leases(start_date, end_date, status)').order('asset_tag')
      if (!assets) return []
      const from = parseISO(filters.dateFrom)
      const to = parseISO(filters.dateTo)
      const periodDays = differenceInDays(to, from) + 1
      return assets.filter(a => !filters.assetType || a.asset_type === filters.assetType).map(a => {
        const leaseDays = (a.leases ?? []).reduce((sum, l) => {
          const s = parseISO(l.start_date) > from ? parseISO(l.start_date) : from
          const e = parseISO(l.end_date) < to ? parseISO(l.end_date) : to
          return sum + Math.max(0, differenceInDays(e, s) + 1)
        }, 0)
        return { ...a, leaseDays, idleDays: periodDays - leaseDays, utilPct: periodDays ? ((leaseDays / periodDays) * 100).toFixed(1) : 0 }
      })
    },
  })

  const { data: billing = [], isLoading: l3 } = useQuery({
    queryKey: ['report-billing', filters],
    enabled: tab === 2,
    queryFn: async () => {
      let q = supabase.from('leases')
        .select('project_id, total_cost_ugx, adjusted_cost_ugx, assets(asset_type), projects(project_name, project_code, grant_code)')
        .gte('start_date', filters.dateFrom)
        .lte('start_date', filters.dateTo)
      if (filters.projectId) q = q.eq('project_id', filters.projectId)
      const { data } = await q
      if (!data) return []
      const grouped = {}
      data.forEach(l => {
        const key = l.project_id
        if (!grouped[key]) grouped[key] = { project_name: l.projects?.project_name, project_code: l.projects?.project_code, grant_code: l.projects?.grant_code, laptop_days: 0, laptop_cost: 0, pda_days: 0, pda_cost: 0 }
        const cost = Number(l.adjusted_cost_ugx ?? l.total_cost_ugx ?? 0)
        if (l.assets?.asset_type === 'laptop') { grouped[key].laptop_days++; grouped[key].laptop_cost += cost }
        else { grouped[key].pda_days++; grouped[key].pda_cost += cost }
      })
      return Object.values(grouped)
    },
  })

  const { data: depreciation = [], isLoading: l4 } = useQuery({
    queryKey: ['report-depreciation'],
    enabled: tab === 3 && isFinance,
    queryFn: async () => {
      const { data: settingsData } = await supabase.from('settings').select('*')
      const settings = Object.fromEntries((settingsData ?? []).map(r => [r.key, r.value]))
      const { data: assets } = await supabase.from('assets').select('*').order('asset_tag')
      return (assets ?? []).filter(a => !filters.assetType || a.asset_type === filters.assetType).map(a => {
        const life = Number(settings[`${a.asset_type}_useful_life_years`] ?? DEFAULT_USEFUL_LIFE[a.asset_type])
        const dep = calcDepreciation(Number(a.purchase_cost), a.purchase_date, life)
        return { ...a, ...dep, life }
      })
    },
  })

  function exportCSV() {
    if (tab === 0) downloadCSV(leaseSummary.map(l => ({ 'Asset Tag': l.assets?.asset_tag, 'Type': l.assets?.asset_type, 'Model': l.assets?.model, 'Project': l.projects?.project_name, 'Booked By': l.users?.full_name, 'Start': l.start_date, 'End': l.end_date, 'Days': differenceInDays(parseISO(l.end_date), parseISO(l.start_date)) + 1, 'Rate': l.daily_rate_ugx, 'Cost (UGX)': l.total_cost_ugx, 'Status': l.status })), 'lease-summary.csv')
    if (tab === 1) downloadCSV(utilization.map(a => ({ 'Asset Tag': a.asset_tag, 'Type': a.asset_type, 'Model': a.model, 'Lease Days': a.leaseDays, 'Idle Days': a.idleDays, 'Utilization %': a.utilPct })), 'utilization.csv')
    if (tab === 2) downloadCSV(billing.map(r => ({ 'Project': r.project_name, 'Code': r.project_code, 'Grant': r.grant_code || '', 'Laptop Days': r.laptop_days, 'Laptop Cost': r.laptop_cost, 'PDA Days': r.pda_days, 'PDA Cost': r.pda_cost, 'Total': r.laptop_cost + r.pda_cost })), 'project-billing.csv')
    if (tab === 3) downloadCSV(depreciation.map(a => ({ 'Asset Tag': a.asset_tag, 'Type': a.asset_type, 'Model': a.model, 'Purchase Date': a.purchase_date, 'Purchase Cost': a.purchase_cost, 'Accumulated Depr.': a.accumulated.toFixed(0), 'Book Value': a.bookValue.toFixed(0), 'Fully Deprecated': a.isFullyDepreciated ? 'Yes' : 'No' })), 'depreciation.csv')
  }

  const isLoading = [l1, l2, l3, l4][tab]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.filter((t, i) => i !== 3 || isFinance).map((t, i) => {
          const realIdx = t === 'Depreciation' ? 3 : TABS.indexOf(t)
          return (
            <button key={t} onClick={() => setTab(realIdx)}
              className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${tab === realIdx ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              {t}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <select value={filters.assetType} onChange={e => setFilters(f => ({ ...f, assetType: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">All Types</option>
          <option value="laptop">Laptop</option>
          <option value="pda">PDA</option>
        </select>
        {tab !== 1 && (
          <select value={filters.projectId} onChange={e => setFilters(f => ({ ...f, projectId: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
          </select>
        )}
        {tab === 0 && (
          <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="returned">Returned</option>
            <option value="cancelled">Cancelled</option>
          </select>
        )}
        <div className="ml-auto flex gap-2 no-print">
          <button onClick={exportCSV} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Export CSV</button>
          <button onClick={() => window.print()} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Print</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-5"><SkeletonTable cols={6} rows={8} /></div>
        ) : tab === 0 ? (
          leaseSummary.length === 0 ? <EmptyState title="No leases in this period" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
                  {['Asset Tag','Type','Model','Project','Booked By','Start','End','Days','Daily Rate','Cost','Status'].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
                </tr></thead>
                <tbody>{leaseSummary.map((l, i) => (
                  <tr key={l.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i%2?'bg-gray-50/40':''}`}>
                    <td className="px-4 py-3 font-medium">{l.assets?.asset_tag}</td>
                    <td className="px-4 py-3 capitalize">{l.assets?.asset_type}</td>
                    <td className="px-4 py-3">{l.assets?.model}</td>
                    <td className="px-4 py-3">{l.projects?.project_name}</td>
                    <td className="px-4 py-3">{l.users?.full_name}</td>
                    <td className="px-4 py-3">{l.start_date}</td>
                    <td className="px-4 py-3">{l.end_date}</td>
                    <td className="px-4 py-3">{differenceInDays(parseISO(l.end_date), parseISO(l.start_date)) + 1}</td>
                    <td className="px-4 py-3">{formatUGX(l.daily_rate_ugx)}</td>
                    <td className="px-4 py-3 font-medium">{formatUGX(l.total_cost_ugx)}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${l.status==='active'?'bg-blue-100 text-blue-800':l.status==='returned'?'bg-gray-100 text-gray-600':'bg-red-100 text-red-700'}`}>{l.status}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )
        ) : tab === 1 ? (
          utilization.length === 0 ? <EmptyState title="No assets" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
                  {['Asset Tag','Type','Model','Lease Days','Idle Days','Utilization %'].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
                </tr></thead>
                <tbody>{utilization.map((a, i) => (
                  <tr key={a.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i%2?'bg-gray-50/40':''}`}>
                    <td className="px-4 py-3 font-medium">{a.asset_tag}</td>
                    <td className="px-4 py-3 capitalize">{a.asset_type}</td>
                    <td className="px-4 py-3">{a.model}</td>
                    <td className="px-4 py-3">{a.leaseDays}</td>
                    <td className="px-4 py-3">{a.idleDays}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5 max-w-[80px]">
                          <div className="bg-primary-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, a.utilPct)}%` }} />
                        </div>
                        <span>{a.utilPct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )
        ) : tab === 2 ? (
          billing.length === 0 ? <EmptyState title="No billing data" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
                  {['Project','Code','Grant Code','Laptop Days','Laptop Cost','PDA Days','PDA Cost','Grand Total'].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
                </tr></thead>
                <tbody>{billing.map((r, i) => (
                  <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50 ${i%2?'bg-gray-50/40':''}`}>
                    <td className="px-4 py-3 font-medium">{r.project_name}</td>
                    <td className="px-4 py-3">{r.project_code}</td>
                    <td className="px-4 py-3 text-gray-500">{r.grant_code || '-'}</td>
                    <td className="px-4 py-3">{r.laptop_days}</td>
                    <td className="px-4 py-3">{formatUGX(r.laptop_cost)}</td>
                    <td className="px-4 py-3">{r.pda_days}</td>
                    <td className="px-4 py-3">{formatUGX(r.pda_cost)}</td>
                    <td className="px-4 py-3 font-semibold">{formatUGX(r.laptop_cost + r.pda_cost)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )
        ) : (
          depreciation.length === 0 ? <EmptyState title="No assets" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
                  {['Asset Tag','Type','Model','Purchase Date','Purchase Cost','Accum. Depr.','Book Value','Fully Depr.?'].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
                </tr></thead>
                <tbody>{depreciation.map((a, i) => (
                  <tr key={a.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i%2?'bg-gray-50/40':''}`}>
                    <td className="px-4 py-3 font-medium">{a.asset_tag}</td>
                    <td className="px-4 py-3 capitalize">{a.asset_type}</td>
                    <td className="px-4 py-3">{a.model}</td>
                    <td className="px-4 py-3">{formatDate(a.purchase_date)}</td>
                    <td className="px-4 py-3">{formatUGX(a.purchase_cost)}</td>
                    <td className="px-4 py-3">{formatUGX(a.accumulated)}</td>
                    <td className="px-4 py-3 font-medium">{formatUGX(a.bookValue)}</td>
                    <td className="px-4 py-3">{a.isFullyDepreciated ? <span className="text-red-600 font-medium">Yes</span> : <span className="text-gray-400">No</span>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}
