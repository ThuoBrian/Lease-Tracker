import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import SkeletonTable from '../components/SkeletonTable'
import EmptyState from '../components/EmptyState'

function ProjectForm({ initial, onClose, onSaved, managers, fieldManagers }) {
  const [form, setForm] = useState(initial ?? { project_name: '', project_code: '', grant_code: '', budget_holder_id: '', field_manager_id: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = { ...form, budget_holder_id: form.budget_holder_id || null, field_manager_id: form.field_manager_id || null }
    const { error: err } = initial?.id
      ? await supabase.from('projects').update(payload).eq('id', initial.id)
      : await supabase.from('projects').insert({ ...payload, is_active: true })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-semibold text-gray-900">{initial?.id ? 'Edit' : 'New'} Project</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          {[
            { name: 'project_name', label: 'Project Name', required: true },
            { name: 'project_code', label: 'Project Code', required: true },
            { name: 'grant_code', label: 'Grant Code' },
          ].map(f => (
            <div key={f.name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}{f.required && ' *'}</label>
              <input required={f.required} value={form[f.name]} onChange={e => setForm(p => ({ ...p, [f.name]: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget Holder (Project Manager)</label>
            <select value={form.budget_holder_id} onChange={e => setForm(p => ({ ...p, budget_holder_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">None</option>
              {managers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Field Manager</label>
            <select value={form.field_manager_id} onChange={e => setForm(p => ({ ...p, field_manager_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">None</option>
              {fieldManagers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
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

export default function Projects() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editProject, setEditProject] = useState(null)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', showArchived],
    queryFn: async () => {
      let q = supabase.from('projects').select('*, users!projects_budget_holder_id_fkey(full_name), fm:users!projects_field_manager_id_fkey(full_name)').order('project_name')
      if (!showArchived) q = q.eq('is_active', true)
      const { data } = await q
      return data ?? []
    },
  })

  const { data: managers = [] } = useQuery({
    queryKey: ['users-pm'],
    queryFn: async () => {
      const { data } = await supabase.from('users').select('id, full_name').eq('role', 'project_manager').eq('is_active', true)
      return data ?? []
    },
    enabled: isAdmin,
  })

  const { data: fieldManagers = [] } = useQuery({
    queryKey: ['users-fm'],
    queryFn: async () => {
      const { data } = await supabase.from('users').select('id, full_name').eq('role', 'field_manager').eq('is_active', true)
      return data ?? []
    },
    enabled: isAdmin,
  })

  const archiveMutation = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase.from('projects').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(['projects']),
  })

  const filtered = projects.filter(p => !search || p.project_name.toLowerCase().includes(search.toLowerCase()) || p.project_code.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input type="search" placeholder="Search projects…" value={search} onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-64" />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} className="rounded" />
          Show Archived
        </label>
        {isAdmin && (
          <button onClick={() => setShowForm(true)}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">
            <Plus className="w-4 h-4" /> New Project
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-5"><SkeletonTable cols={5} rows={6} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No projects found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 font-medium">Project Name</th>
                  <th className="px-5 py-3 font-medium">Code</th>
                  <th className="px-5 py-3 font-medium">Grant Code</th>
                  <th className="px-5 py-3 font-medium">Budget Holder</th>
                  <th className="px-5 py-3 font-medium">Field Manager</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  {isAdmin && <th className="px-5 py-3 font-medium"></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 !== 0 ? 'bg-gray-50/40' : ''}`}>
                    <td className="px-5 py-3 font-medium text-gray-900">{p.project_name}</td>
                    <td className="px-5 py-3 text-gray-600">{p.project_code}</td>
                    <td className="px-5 py-3 text-gray-500">{p.grant_code || '-'}</td>
                    <td className="px-5 py-3 text-gray-600">{p.users?.full_name || '-'}</td>
                    <td className="px-5 py-3 text-gray-600">{p.fm?.full_name || '-'}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {p.is_active ? 'Active' : 'Archived'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setEditProject(p)} className="text-gray-400 hover:text-gray-700">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => archiveMutation.mutate({ id: p.id, is_active: !p.is_active })}
                            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-0.5">
                            {p.is_active ? 'Archive' : 'Restore'}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && <ProjectForm onClose={() => setShowForm(false)} onSaved={() => qc.invalidateQueries(['projects'])} managers={managers} fieldManagers={fieldManagers} />}
      {editProject && <ProjectForm initial={editProject} onClose={() => setEditProject(null)} onSaved={() => qc.invalidateQueries(['projects'])} managers={managers} fieldManagers={fieldManagers} />}
    </div>
  )
}
