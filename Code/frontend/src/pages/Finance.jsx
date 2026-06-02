import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { formatUGX, downloadCSV, downloadPDF } from '../lib/utils'
import SkeletonTable from '../components/SkeletonTable'
import EmptyState from '../components/EmptyState'

export default function Finance() {
  const now = new Date()
  const [month, setMonth] = useState(format(now, 'yyyy-MM'))
  const [projectFilter, setProjectFilter] = useState('')

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, project_name, project_code').order('project_name')
      return data ?? []
    },
  })

  const { data: summary = [], isLoading } = useQuery({
    queryKey: ['finance-summary', month, projectFilter],
    queryFn: async () => {
      const start = startOfMonth(parseISO(`${month}-01`)).toISOString().split('T')[0]
      const end = endOfMonth(parseISO(`${month}-01`)).toISOString().split('T')[0]
      let q = supabase
        .from('leases')
        .select('project_id, total_cost_ugx, adjusted_cost_ugx, assets(asset_type), projects(project_name, project_code, grant_code)')
        .gte('start_date', start)
        .lte('start_date', end)
      if (projectFilter) q = q.eq('project_id', projectFilter)
      const { data } = await q
      if (!data) return []

      const grouped = {}
      data.forEach(l => {
        const key = l.project_id
        if (!grouped[key]) grouped[key] = { project_name: l.projects?.project_name, project_code: l.projects?.project_code, grant_code: l.projects?.grant_code, laptops: 0, laptop_cost: 0, pdas: 0, pda_cost: 0 }
        const cost = Number(l.adjusted_cost_ugx ?? l.total_cost_ugx ?? 0)
        if (l.assets?.asset_type === 'laptop') { grouped[key].laptops++; grouped[key].laptop_cost += cost }
        else { grouped[key].pdas++; grouped[key].pda_cost += cost }
      })
      return Object.values(grouped)
    },
  })

  const totals = summary.reduce((acc, r) => ({
    laptops: acc.laptops + r.laptops,
    laptop_cost: acc.laptop_cost + r.laptop_cost,
    pdas: acc.pdas + r.pdas,
    pda_cost: acc.pda_cost + r.pda_cost,
    total: acc.total + r.laptop_cost + r.pda_cost,
  }), { laptops: 0, laptop_cost: 0, pdas: 0, pda_cost: 0, total: 0 })

  function handleCSV() {
    downloadCSV(summary.map(r => ({
      'Project': r.project_name,
      'Code': r.project_code,
      'Grant Code': r.grant_code || '',
      '# Laptops': r.laptops,
      'Laptop Cost (UGX)': r.laptop_cost,
      '# PDAs': r.pdas,
      'PDA Cost (UGX)': r.pda_cost,
      'Total (UGX)': r.laptop_cost + r.pda_cost,
    })), `finance-${month}.csv`)
  }

  function handlePDF() {
    downloadPDF(
      `Finance Summary — ${month}`,
      ['Project', 'Code', '# Laptops', 'Laptop Cost', '# PDAs', 'PDA Cost', 'Total'],
      summary.map(r => [r.project_name, r.project_code, r.laptops, formatUGX(r.laptop_cost), r.pdas, formatUGX(r.pda_cost), formatUGX(r.laptop_cost + r.pda_cost)]),
      `finance-${month}.pdf`
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
        </select>
        <div className="ml-auto flex gap-2 no-print">
          <button onClick={handleCSV} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Export CSV</button>
          <button onClick={handlePDF} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Export PDF</button>
          <button onClick={() => window.print()} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Print</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-5"><SkeletonTable cols={7} rows={6} /></div>
        ) : summary.length === 0 ? (
          <EmptyState title="No billing data" description="No leases started in this period." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Code</th>
                  <th className="px-5 py-3 font-medium text-right"># Laptops</th>
                  <th className="px-5 py-3 font-medium text-right">Laptop Cost</th>
                  <th className="px-5 py-3 font-medium text-right"># PDAs</th>
                  <th className="px-5 py-3 font-medium text-right">PDA Cost</th>
                  <th className="px-5 py-3 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((r, i) => (
                  <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 !== 0 ? 'bg-gray-50/40' : ''}`}>
                    <td className="px-5 py-3 font-medium text-gray-900">{r.project_name}</td>
                    <td className="px-5 py-3 text-gray-600">{r.project_code}</td>
                    <td className="px-5 py-3 text-right">{r.laptops}</td>
                    <td className="px-5 py-3 text-right">{formatUGX(r.laptop_cost)}</td>
                    <td className="px-5 py-3 text-right">{r.pdas}</td>
                    <td className="px-5 py-3 text-right">{formatUGX(r.pda_cost)}</td>
                    <td className="px-5 py-3 text-right font-semibold">{formatUGX(r.laptop_cost + r.pda_cost)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-100 font-semibold text-gray-900">
                  <td className="px-5 py-3" colSpan={2}>Total</td>
                  <td className="px-5 py-3 text-right">{totals.laptops}</td>
                  <td className="px-5 py-3 text-right">{formatUGX(totals.laptop_cost)}</td>
                  <td className="px-5 py-3 text-right">{totals.pdas}</td>
                  <td className="px-5 py-3 text-right">{formatUGX(totals.pda_cost)}</td>
                  <td className="px-5 py-3 text-right">{formatUGX(totals.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
