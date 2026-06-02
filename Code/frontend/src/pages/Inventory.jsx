import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, Download, Trash2, Plus, X, ChevronDown, ChevronUp } from 'lucide-react'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatUGX, formatDate, calcDepreciation, downloadCSV } from '../lib/utils'
import { DEFAULT_USEFUL_LIFE } from '../lib/constants'
import StatusBadge from '../components/StatusBadge'
import SkeletonTable from '../components/SkeletonTable'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'

const CSV_TEMPLATE = 'asset_tag,serial_number,model,manufacturer,purchase_date,purchase_cost,condition,notes\nLT-001,SN123456,Dell Latitude 5420,Dell,2022-01-15,2500000,good,\n'

function AssetForm({ assetType, onClose, onSaved, initial }) {
  const [form, setForm] = useState(initial ?? { asset_tag: '', serial_number: '', model: '', manufacturer: '', purchase_date: '', purchase_cost: '', condition: 'good', notes: '', status: 'available' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = { ...form, asset_type: assetType, purchase_cost: Number(form.purchase_cost) }
    const { error: err } = initial?.id
      ? await supabase.from('assets').update(payload).eq('id', initial.id)
      : await supabase.from('assets').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-semibold text-gray-900">{initial?.id ? 'Edit' : 'Add'} {assetType === 'laptop' ? 'Laptop' : 'PDA'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
          {[
            { name: 'asset_tag', label: 'Asset Tag', required: true },
            { name: 'serial_number', label: 'Serial Number', required: true },
            { name: 'model', label: 'Model', required: true },
            { name: 'manufacturer', label: 'Manufacturer' },
          ].map(f => (
            <div key={f.name}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}{f.required && ' *'}</label>
              <input required={f.required} value={form[f.name]} onChange={e => setForm(p => ({ ...p, [f.name]: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Purchase Date *</label>
            <input type="date" required value={form.purchase_date} onChange={e => setForm(p => ({ ...p, purchase_date: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Purchase Cost (UGX) *</label>
            <input type="number" required min="0" value={form.purchase_cost} onChange={e => setForm(p => ({ ...p, purchase_cost: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Condition</label>
            <select value={form.condition} onChange={e => setForm(p => ({ ...p, condition: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </select>
          </div>
          {initial?.id && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                disabled={form.status === 'leased'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50">
                <option value="available">Available</option>
                <option value="maintenance">Maintenance</option>
                {form.status === 'leased' && <option value="leased">Leased</option>}
              </select>
              {form.status === 'leased' && <p className="text-xs text-amber-600 mt-1">Return the active lease before changing status.</p>}
            </div>
          )}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
          <div className="col-span-2 flex justify-end gap-3 mt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AssetDetailPanel({ asset, assetType, onClose }) {
  const life = DEFAULT_USEFUL_LIFE[assetType]
  const dep = calcDepreciation(Number(asset.purchase_cost), asset.purchase_date, life)

  const { data: leaseHistory } = useQuery({
    queryKey: ['asset-leases', asset.id],
    queryFn: async () => {
      const { data } = await supabase.from('leases')
        .select('*, projects(project_name), users!leases_booked_by_id_fkey(full_name)')
        .eq('asset_id', asset.id)
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end bg-black/40">
      <div className="bg-white h-full sm:h-auto sm:max-h-[90vh] w-full sm:w-[520px] overflow-y-auto shadow-xl sm:rounded-l-2xl flex flex-col">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="font-semibold text-gray-900">{asset.asset_tag} — Detail</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            {[
              ['Model', asset.model],
              ['Manufacturer', asset.manufacturer || '-'],
              ['Serial No.', asset.serial_number],
              ['Condition', <StatusBadge key="c" value={asset.condition} />],
              ['Status', <StatusBadge key="s" value={asset.status} />],
              ['Purchase Date', formatDate(asset.purchase_date)],
              ['Purchase Cost', formatUGX(asset.purchase_cost)],
              ['Book Value', formatUGX(dep.bookValue)],
              ['Depreciated', dep.isFullyDepreciated ? <span key="fd" className="text-red-600 font-medium">Fully Depreciated</span> : formatDate(dep.fullyDepreciatedDate?.toISOString())],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-gray-500">{k}</dt>
                <dd className="font-medium text-gray-900">{v}</dd>
              </div>
            ))}
          </dl>
          {asset.notes && <p className="text-sm text-gray-500 italic">{asset.notes}</p>}

          <div>
            <h4 className="font-medium text-gray-900 mb-2">Lease History</h4>
            {!leaseHistory ? (
              <SkeletonTable cols={3} rows={3} />
            ) : leaseHistory.length === 0 ? (
              <p className="text-sm text-gray-400">No lease history</p>
            ) : (
              <div className="space-y-2">
                {leaseHistory.map(l => (
                  <div key={l.id} className="bg-gray-50 rounded-lg px-3 py-2 text-xs">
                    <div className="flex justify-between">
                      <span className="font-medium">{l.projects?.project_name}</span>
                      <StatusBadge value={l.status} />
                    </div>
                    <p className="text-gray-500 mt-0.5">{l.start_date} → {l.end_date} · {l.users?.full_name}</p>
                    <p className="text-gray-700 font-medium">{formatUGX(l.total_cost_ugx)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Inventory({ assetType }) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const qc = useQueryClient()
  const label = assetType === 'laptop' ? 'Laptop' : 'PDA'

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [conditionFilter, setConditionFilter] = useState('')
  const [selected, setSelected] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editAsset, setEditAsset] = useState(null)
  const [detailAsset, setDetailAsset] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const [importing, setImporting] = useState(false)

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets', assetType],
    queryFn: async () => {
      const { data } = await supabase
        .from('assets')
        .select('*, leases(project_id, projects(project_name))')
        .eq('asset_type', assetType)
        .order('asset_tag')
      return data ?? []
    },
  })

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await supabase.from('settings').select('*')
      return Object.fromEntries((data ?? []).map(r => [r.key, r.value]))
    },
  })

  const usefulLife = settings
    ? Number(settings[`${assetType}_useful_life_years`] ?? DEFAULT_USEFUL_LIFE[assetType])
    : DEFAULT_USEFUL_LIFE[assetType]

  const deleteMutation = useMutation({
    mutationFn: async (ids) => {
      const { error } = await supabase.from('assets').delete().in('id', ids)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries(['assets', assetType]); setSelected([]) },
  })

  const filtered = assets.filter(a => {
    const matchSearch = !search || a.asset_tag.toLowerCase().includes(search.toLowerCase()) || a.model.toLowerCase().includes(search.toLowerCase()) || a.serial_number.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || a.status === statusFilter
    const matchCond = !conditionFilter || a.condition === conditionFilter
    return matchSearch && matchStatus && matchCond
  })

  function toggleSelect(id) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => {
        const required = ['asset_tag', 'serial_number', 'model', 'purchase_date', 'purchase_cost']
        const existingTags = new Set(assets.map(a => a.asset_tag))
        const existingSerials = new Set(assets.map(a => a.serial_number))
        const valid = [], errors = [], duplicates = []
        data.forEach((row, i) => {
          const missing = required.filter(f => !row[f])
          if (missing.length) { errors.push(`Row ${i + 2}: missing ${missing.join(', ')}`); return }
          if (existingTags.has(row.asset_tag) || existingSerials.has(row.serial_number)) { duplicates.push(row.asset_tag); return }
          valid.push({ asset_type: assetType, asset_tag: row.asset_tag, serial_number: row.serial_number, model: row.model, manufacturer: row.manufacturer || null, purchase_date: row.purchase_date, purchase_cost: Number(row.purchase_cost), condition: row.condition || 'good', notes: row.notes || null, status: 'available' })
        })
        setImportPreview({ valid, errors, duplicates })
      },
    })
    e.target.value = ''
  }

  async function commitImport() {
    if (!importPreview?.valid?.length) return
    setImporting(true)
    const { error } = await supabase.from('assets').insert(importPreview.valid)
    setImporting(false)
    if (!error) { qc.invalidateQueries(['assets', assetType]); setImportPreview(null) }
    else alert(error.message)
  }

  const deletableIds = selected.filter(id => {
    const asset = assets.find(a => a.id === id)
    return asset && (!asset.leases || asset.leases.length === 0)
  })
  const blockedCount = selected.length - deletableIds.length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder={`Search ${label}s…`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-64"
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">All Statuses</option>
          <option value="available">Available</option>
          <option value="leased">Leased</option>
          <option value="maintenance">Maintenance</option>
        </select>
        <select value={conditionFilter} onChange={e => setConditionFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">All Conditions</option>
          <option value="good">Good</option>
          <option value="fair">Fair</option>
          <option value="poor">Poor</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          {isAdmin && (
            <>
              <button onClick={() => downloadCSV([{ asset_tag: '', serial_number: '', model: '', manufacturer: '', purchase_date: 'YYYY-MM-DD', purchase_cost: '', condition: 'good', notes: '' }], `${assetType}-template.csv`)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                <Download className="w-4 h-4" /> Template
              </button>
              <label className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                <Upload className="w-4 h-4" /> Import CSV
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
              </label>
              {selected.length > 0 && (
                <button onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
                  <Trash2 className="w-4 h-4" /> Delete ({selected.length})
                </button>
              )}
              <button onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                <Plus className="w-4 h-4" /> Add {label}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-5"><SkeletonTable cols={7} rows={8} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState title={`No ${label}s found`} description="Try adjusting your filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
                  {isAdmin && <th className="px-4 py-3 w-8"><input type="checkbox" className="rounded" onChange={e => setSelected(e.target.checked ? filtered.map(a => a.id) : [])} checked={selected.length === filtered.length && filtered.length > 0} /></th>}
                  <th className="px-4 py-3 font-medium">Asset Tag</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Condition</th>
                  <th className="px-4 py-3 font-medium">Current Project</th>
                  <th className="px-4 py-3 font-medium">Purchase Date</th>
                  <th className="px-4 py-3 font-medium">Book Value</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((asset, i) => {
                  const dep = calcDepreciation(Number(asset.purchase_cost), asset.purchase_date, usefulLife)
                  const activeProject = asset.leases?.find(l => l)?.projects?.project_name
                  return (
                    <tr key={asset.id} className={`border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer ${i % 2 !== 0 ? 'bg-gray-50/40' : ''}`}
                      onClick={e => { if (e.target.type !== 'checkbox') setDetailAsset(asset) }}>
                      {isAdmin && (
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" className="rounded" checked={selected.includes(asset.id)} onChange={() => toggleSelect(asset.id)} />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{asset.asset_tag}</p>
                        <p className="text-xs text-gray-400">{asset.serial_number}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{asset.model}</td>
                      <td className="px-4 py-3"><StatusBadge value={asset.status} /></td>
                      <td className="px-4 py-3"><StatusBadge value={asset.condition} /></td>
                      <td className="px-4 py-3 text-gray-600">{activeProject || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(asset.purchase_date)}</td>
                      <td className="px-4 py-3">
                        <span className={dep.isFullyDepreciated ? 'text-red-600 font-medium' : 'text-gray-900 font-medium'}>{formatUGX(dep.bookValue)}</span>
                        {dep.isFullyDepreciated && <span className="ml-1 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Fully Depr.</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && <AssetForm assetType={assetType} onClose={() => setShowForm(false)} onSaved={() => qc.invalidateQueries(['assets', assetType])} />}
      {editAsset && <AssetForm assetType={assetType} initial={editAsset} onClose={() => setEditAsset(null)} onSaved={() => qc.invalidateQueries(['assets', assetType])} />}
      {detailAsset && <AssetDetailPanel asset={detailAsset} assetType={assetType} onClose={() => setDetailAsset(null)} />}

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${selected.length} asset${selected.length > 1 ? 's' : ''}?`}
        message={`${deletableIds.length} will be deleted. ${blockedCount > 0 ? `${blockedCount} cannot be deleted (have lease history).` : ''}`}
        confirmLabel="Delete"
        danger
        onConfirm={() => { deleteMutation.mutate(deletableIds); setConfirmDelete(false) }}
        onCancel={() => setConfirmDelete(false)}
      />

      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Confirm Import</h3>
            <div className="text-sm space-y-1">
              <p><span className="font-medium text-green-700">{importPreview.valid.length}</span> assets will be imported.</p>
              <p><span className="font-medium text-amber-700">{importPreview.duplicates.length}</span> duplicates will be skipped ({importPreview.duplicates.slice(0, 5).join(', ')}{importPreview.duplicates.length > 5 ? '…' : ''}).</p>
              {importPreview.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 mt-2">
                  <p className="font-medium text-red-700">Row errors:</p>
                  {importPreview.errors.slice(0, 5).map((e, i) => <p key={i} className="text-red-600">{e}</p>)}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setImportPreview(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={commitImport} disabled={importing || importPreview.valid.length === 0}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60">
                {importing ? 'Importing…' : `Import ${importPreview.valid.length}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
