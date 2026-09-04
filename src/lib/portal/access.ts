import type { ApplicationRole } from './types'

export type PrivateArea = 'portal' | 'admin'
export type PrivateHomePath = '/portal' | '/admin'
export type PrivateLoginPath = '/portal/login' | '/admin/login'

export function getPrivateHomePath(role: ApplicationRole): PrivateHomePath {
  return role === 'customer' ? '/portal' : '/admin'
}

export function getPrivateLoginPath(area: PrivateArea): PrivateLoginPath {
  return area === 'admin' ? '/admin/login' : '/portal/login'
}

export function canAccessPrivateArea(role: ApplicationRole, area: PrivateArea) {
  return area === 'admin' ? role === 'staff' || role === 'admin' : role === 'customer'
}

export function getRoleLabel(role: ApplicationRole) {
  if (role === 'admin') return 'Administrator'
  if (role === 'staff') return 'Staff member'
  return 'Client'
}
