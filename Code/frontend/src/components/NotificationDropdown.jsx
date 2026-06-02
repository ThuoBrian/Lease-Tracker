import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatDate } from '../lib/utils'

const TYPE_COLOURS = {
  pickup_ready: 'bg-blue-100 text-blue-800',
  expiry_reminder: 'bg-amber-100 text-amber-800',
  overdue: 'bg-red-100 text-red-800',
  system: 'bg-purple-100 text-purple-800',
}

export default function NotificationDropdown() {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const ref = useRef(null)

  async function load() {
    if (!profile) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(30)
    setNotifications(data ?? [])
  }

  useEffect(() => { load() }, [profile])

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function markRead(id) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x))
  }

  async function markAllRead() {
    if (!profile) return
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false)
    setNotifications(n => n.map(x => ({ ...x, is_read: true })))
  }

  const unread = notifications.filter(n => !n.is_read).length

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(o => !o); load() }}
        className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-600"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-96 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-[480px] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-900">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary-600 hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No notifications</p>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${!n.is_read ? 'bg-blue-50' : ''}`}
                  onClick={() => markRead(n.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium mb-1 ${TYPE_COLOURS[n.type] ?? 'bg-gray-100 text-gray-700'}`}>
                        {n.type?.replace(/_/g, ' ')}
                      </span>
                      <p className="text-sm font-medium text-gray-900">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap mt-1">{formatDate(n.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
