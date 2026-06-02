import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { calcLeaseCost, formatUGX } from '../lib/utils'
import { DEFAULT_RATES } from '../lib/constants'

export default function BookLease() {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  const [assetType, setAssetType] = useState('laptop')
  const [projectId, setProjectId] = useState('')
  const [assetId, setAssetId] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await supabase.from('settings').select('*')
      return Object.fromEntries((data ?? []).map(r => [r.key, r.value]))
    },
  })

  const rates = {
    pda: Number(settings?.pda_daily_rate_ugx ?? DEFAULT_RATES.pda),
    laptop: Number(settings?.laptop_daily_rate_ugx ?? DEFAULT_RATES.laptop),
  }

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-for-booking', profile?.id, profile?.role],
    queryFn: async () => {
      let q = supabase.from('projects').select('id, project_name, project_code').eq('is_active', true)
      if (profile?.role === 'project_manager') q = q.eq('budget_holder_id', profile.id)
      else if (['field_manager', 'research_associate'].includes(profile?.role)) q = q.eq('field_manager_id', profile.id)
      const { data } = await q.order('project_name')
      return data ?? []
    },
    enabled: !!profile,
  })

  const { data: availableAssets = [] } = useQuery({
    queryKey: ['available-assets', assetType],
    queryFn: async () => {
      const { data } = await supabase
        .from('assets')
        .select('id, asset_tag, model, serial_number')
        .eq('asset_type', assetType)
        .eq('status', 'available')
        .order('asset_tag')
      return data ?? []
    },
  })

  const cost = startDate && endDate && endDate > startDate ? calcLeaseCost(assetType, startDate, endDate, rates) : null

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!endDate || endDate <= startDate) { setError('End date must be after start date.'); return }
    if (!assetId) { setError('Please select an asset.'); return }
    if (!projectId) { setError('Please select a project.'); return }
    setSubmitting(true)

    const { data: currentAsset } = await supabase.from('assets').select('status').eq('id', assetId).single()
    if (currentAsset?.status !== 'available') {
      setSubmitting(false)
      setError('Already assigned')
      return
    }

    const { error: leaseErr } = await supabase.from('leases').insert({
      asset_id: assetId,
      project_id: projectId,
      booked_by_id: profile.id,
      start_date: startDate,
      end_date: endDate,
      daily_rate_ugx: rates[assetType],
      total_cost_ugx: cost?.total,
      status: 'active',
      notes: notes || null,
    })

    if (leaseErr) { setSubmitting(false); setError(leaseErr.message); return }

    await supabase.from('assets').update({ status: 'leased' }).eq('id', assetId)
    await supabase.from('notifications').insert({
      user_id: profile.id,
      type: 'system',
      title: 'Lease Confirmed',
      message: `Your lease for the selected ${assetType === 'laptop' ? 'laptop' : 'PDA'} from ${startDate} to ${endDate} has been booked.`,
    })

    qc.invalidateQueries(['assets'])
    qc.invalidateQueries(['leases'])
    setSubmitting(false)
    setSuccess('Lease booked successfully!')
    setAssetId('')
    setProjectId('')
    setEndDate('')
    setNotes('')
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Asset Type</label>
            <div className="flex gap-3">
              {[{ value: 'laptop', label: 'Laptop' }, { value: 'pda', label: 'PDA / Tablet' }].map(opt => (
                <button key={opt.value} type="button" onClick={() => { setAssetType(opt.value); setAssetId('') }}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${assetType === opt.value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="project" className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
            <select id="project" required value={projectId} onChange={e => setProjectId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">Select project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_name} ({p.project_code})</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="asset" className="block text-sm font-medium text-gray-700 mb-1">
              {assetType === 'laptop' ? 'Laptop' : 'PDA'} *
            </label>
            <select id="asset" required value={assetId} onChange={e => setAssetId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">Select available {assetType === 'laptop' ? 'laptop' : 'PDA'}…</option>
              {availableAssets.map(a => <option key={a.id} value={a.id}>{a.asset_tag} — {a.model}</option>)}
            </select>
            {availableAssets.length === 0 && <p className="text-xs text-amber-600 mt-1">No {assetType === 'laptop' ? 'laptops' : 'PDAs'} currently available.</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="start" className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input id="start" type="date" required min={today} value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label htmlFor="end" className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
              <input id="end" type="date" required min={startDate || today} value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          {cost && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Rate: {formatUGX(cost.rate)}/day</span>
                <span>{cost.days} day{cost.days > 1 ? 's' : ''}</span>
              </div>
              <div className="flex justify-between font-semibold text-gray-900 mt-1">
                <span>Total Cost</span>
                <span>{formatUGX(cost.total)}</span>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea id="notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          {error && <p className="text-sm text-red-600 font-medium" role="alert">{error}</p>}
          {success && <p className="text-sm text-green-700 font-medium" role="status">{success}</p>}

          <button type="submit" disabled={submitting}
            className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors">
            {submitting ? 'Booking…' : 'Book Lease'}
          </button>
        </form>
      </div>
    </div>
  )
}
