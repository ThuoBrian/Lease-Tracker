import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ROLE_LABELS } from '../lib/constants'
import SkeletonTable from '../components/SkeletonTable'
import EmptyState from '../components/EmptyState'

const ROLES_LIST = Object.entries(ROLE_LABELS)

function UserForm({ initial, onClose, onSaved }) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState(initial ?? { full_name: '', email: '', role: 'field_manager' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    if (isEdit) {
      const { error: err } = await supabase.from('users').update({ full_name: form.full_name, role: form.role }).eq('id', initial.id)
      setSaving(false)
      if (err) { setError(err.message); return }
    } else {
      const { data, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(form.email, {
        data: { full_name: form.full_name, role: form.role },
      })
      if (inviteErr) {
        const { error: err2 } = await supabase.from('users').insert({ full_name: form.full_name, email: form.email, role: form.role, is_active: true })
        setSaving(false)
        if (err2) { setError('Invite failed. Make sure admin rights are enabled for auth.admin.inviteUserByEmail, or add users directly from the Supabase dashboard.'); return }
      } else {
        setSaving(false)
      }
    }
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-semibold text-gray-900">{isEdit ? 'Edit User' : 'Invite User'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input required value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" required value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              {ROLES_LIST.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!isEdit && <p className="text-xs text-gray-500">The user will receive an invitation email to set their password.</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60">
              {saving ? 'Saving…' : isEdit ? 'Save' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function People() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', showInactive],
    queryFn: async () => {
      let q = supabase.from('users').select('*').order('full_name')
      if (!showInactive) q = q.eq('is_active', true)
      const { data } = await q
      return data ?? []
    },
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase.from('users').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(['users']),
  })

  const filtered = users.filter(u => {
    const matchSearch = !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    const matchRole = !roleFilter || u.role === roleFilter
    return matchSearch && matchRole
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input type="search" placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-56" />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">All Roles</option>
          {ROLES_LIST.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded" />
          Show Inactive
        </label>
        <button onClick={() => setShowForm(true)}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <Plus className="w-4 h-4" /> Invite User
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-5"><SkeletonTable cols={5} rows={7} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No users found" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 !== 0 ? 'bg-gray-50/40' : ''}`}>
                  <td className="px-5 py-3 font-medium text-gray-900">{u.full_name}</td>
                  <td className="px-5 py-3 text-gray-600">{u.email}</td>
                  <td className="px-5 py-3">
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">{ROLE_LABELS[u.role] ?? u.role}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditUser(u)} className="text-gray-400 hover:text-gray-700"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => toggleActive.mutate({ id: u.id, is_active: !u.is_active })}
                        className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-0.5">
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && <UserForm onClose={() => setShowForm(false)} onSaved={() => qc.invalidateQueries(['users'])} />}
      {editUser && <UserForm initial={editUser} onClose={() => setEditUser(null)} onSaved={() => qc.invalidateQueries(['users'])} />}
    </div>
  )
}
