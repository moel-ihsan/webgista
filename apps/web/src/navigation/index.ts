import type { AppRole } from '../auth/types'

export interface NavigationItem {
  to: string
  label: string
  icon: string
  roles?: readonly AppRole[]
}

export const navigationItems: readonly NavigationItem[] = [
  { to: '/', label: 'Dashboard', icon: 'home' },
  { to: '/map', label: 'View Map', icon: 'map' },
  {
    to: '/cctv',
    label: 'Data Table',
    icon: 'list',
    roles: ['administrator', 'agency_editor'],
  },
  { to: '/settings', label: 'Settings', icon: 'settings', roles: ['administrator'] },
]

export function navigationForRole(role: AppRole | null): readonly NavigationItem[] {
  return navigationItems.filter((item) => !item.roles || (role !== null && item.roles.includes(role)))
}
