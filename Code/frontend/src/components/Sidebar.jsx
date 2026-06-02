import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Laptop, Tablet, CalendarPlus, ClipboardList,
  DollarSign, FolderOpen, Users, BarChart2, Settings, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { ROLES } from '../lib/constants'

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: null },
  { to: '/laptops', icon: Laptop, label: 'Laptops', roles: null },
  { to: '/pdas', icon: Tablet, label: 'PDAs', roles: null },
  { to: '/book', icon: CalendarPlus, label: 'Book Lease', roles: null },
  { to: '/my-leases', icon: ClipboardList, label: 'My Leases', roles: null },
  { to: '/finance', icon: DollarSign, label: 'Finance', roles: ['admin', 'finance'] },
  { to: '/projects', icon: FolderOpen, label: 'Projects', roles: null },
  { to: '/people', icon: Users, label: 'People', roles: ['admin'] },
  { to: '/reports', icon: BarChart2, label: 'Reports', roles: ['admin', 'finance', 'project_manager'] },
  { to: '/settings', icon: Settings, label: 'Settings', roles: ['admin'] },
]

export default function Sidebar({ collapsed, onToggle }) {
  const { profile } = useAuth()

  return (
    <aside className={`no-print fixed top-0 left-0 h-screen bg-primary-900 text-white flex flex-col transition-all duration-200 z-40 ${collapsed ? 'w-16' : 'w-56'}`}>
      <div className="flex items-center justify-between px-3 py-4 border-b border-primary-700">
        {!collapsed && (
          <span className="font-bold text-sm tracking-wide truncate">Lease Tracker</span>
        )}
        <button onClick={onToggle} className="p-1 rounded hover:bg-primary-700 ml-auto">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5">
        {NAV.filter(item => !item.roles || (profile && item.roles.includes(profile.role))).map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 mx-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-primary-700 text-white font-medium' : 'text-primary-100 hover:bg-primary-800'}`
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {!collapsed && profile && (
        <div className="px-4 py-3 border-t border-primary-700 text-xs text-primary-300">
          <p className="font-medium text-primary-100 truncate">{profile.full_name}</p>
          <p className="capitalize">{profile.role?.replace(/_/g, ' ')}</p>
        </div>
      )}
    </aside>
  )
}
