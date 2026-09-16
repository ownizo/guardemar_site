import { getPortalSupabase } from './supabase'
export async function addonApi<T>(path = '', init?: RequestInit): Promise<T> {
  const supabase = await getPortalSupabase()
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Your session has expired. Please sign in again.')
  const response = await fetch(`/api/addons/${path}`, { ...init, headers: { Accept: 'application/json', Authorization: `Bearer ${data.session.access_token}`, ...(init?.body ? { 'Content-Type': 'application/json' } : {}) } })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error?.message ?? 'The service request could not be completed.')
  return body as T
}
