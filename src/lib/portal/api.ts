import { getPortalSupabase } from './supabase'

export class PortalApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

export async function portalApi<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = await getPortalSupabase()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new PortalApiError('Your session has expired. Please sign in again.', 401)

  const response = await fetch(`/api/portal/${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  const body = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new PortalApiError(body.error ?? 'The portal request failed.', response.status)
  return body as T
}
