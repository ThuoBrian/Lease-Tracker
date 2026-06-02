import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import NotificationDropdown from './NotificationDropdown'
import { useAuth } from '../contexts/AuthContext'
import { LogOut } from 'lucide-react'

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/laptops': 'Laptop Inventory',
  '/pdas': 'PDA Inventory',
  '/book': 'Book a Lease',
  '/my-leases': 'My Leases',
  '/finance': 'Finance Review',
  '/projects': 'Projects',
  '/people': 'People',
  '/reports': 'Reports',
  '/settings': 'Settings',
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const { profile, signOut } = useAuth()
  const location = useLocation()

  const title = Object.entries(PAGE_TITLES).find(([path]) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
  )?.[1] ?? 'Lease Tracker'

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />

      <div className={`flex-1 flex flex-col transition-all duration-200 ${collapsed ? 'ml-16' : 'ml-56'}`}>
        <header className="no-print sticky top-0 z-30 bg-white border-b border-gray-200 flex items-center justify-between px-6 h-14">
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
          <div className="flex items-center gap-2">
            <NotificationDropdown />
            <div className="flex items-center gap-2 ml-2">
              <div className="w-8 h-8 rounded-full bg-primary-600 text-white text-sm font-medium flex items-center justify-center">
                {profile?.full_name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <button
                onClick={signOut}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 print-full">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
