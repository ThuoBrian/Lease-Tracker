import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const SETTING_DEFS = [
  { key: 'pda_daily_rate_ugx', label: 'PDA Daily Rate (UGX)', type: 'number', min: 0 },
  { key: 'laptop_daily_rate_ugx', label: 'Laptop Daily Rate (UGX)', type: 'number', min: 0 },
  { key: 'laptop_useful_life_years', label: 'Laptop Useful Life (years)', type: 'number', min: 1, max: 20 },
  { key: 'pda_useful_life_years', label: 'PDA Useful Life (years)', type: 'number', min: 1, max: 20 },
]

export default function Settings() {
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await supabase.from('settings').select('*')
      return Object.fromEntries((data ?? []).map(r => [r.key, r.value]))
    },
  })

  const [form, setForm] = useState(null)

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      const upserts = Object.entries(values).map(([key, value]) => ({ key, value: String(value) }))
      const { error } = await supabase.from('settings').upsert(upserts, { onConflict: 'key' })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries(['settings'])
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const current = form ?? settings ?? {}

  function handleSubmit(e) {
    e.preventDefault()
    saveMutation.mutate(current)
  }

  if (isLoading) {
    return (
      <div className="max-w-lg space-y-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Billing & Depreciation Settings</h2>
        <p className="text-sm text-gray-500 mb-6">Changes apply to new leases only. Existing lease costs are locked at booking time.</p>
        <form onSubmit={handleSubmit} className="space-y-5">
          {SETTING_DEFS.map(def => (
            <div key={def.key}>
              <label htmlFor={def.key} className="block text-sm font-medium text-gray-700 mb-1">{def.label}</label>
              <input
                id={def.key}
                type={def.type}
                min={def.min}
                max={def.max}
                value={current[def.key] ?? ''}
                onChange={e => setForm(f => ({ ...(f ?? current), [def.key]: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          ))}
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saveMutation.isPending}
              className="px-5 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-60">
              {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
            </button>
            {saved && <span className="text-sm text-green-700 font-medium">Saved!</span>}
            {saveMutation.isError && <span className="text-sm text-red-600">Save failed. Try again.</span>}
          </div>
        </form>
      </div>
    </div>
  )
}
