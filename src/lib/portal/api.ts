import { getPortalSupabase } from './supabase'

export type PortalErrorCode = 'VALIDATION_ERROR' | 'AUTHENTICATION_ERROR' | 'AUTHORIZATION_ERROR' | 'DATABASE_ERROR' | 'STORAGE_ERROR' | 'UPLOAD_ERROR' | 'AUTOSAVE_ERROR' | 'CREATE_RPC_ERROR' | 'POST_CREATE_REFRESH_ERROR' | 'NAVIGATION_ERROR' | 'NETWORK_ERROR'

export class PortalApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: PortalErrorCode,
    public stage: string,
    public details?: string,
    public hint?: string,
  ) {
    super(message)
  }
}

export async function portalApi<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = await getPortalSupabase()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new PortalApiError('Your session has expired. Please sign in again.', 401, 'AUTHENTICATION_ERROR', 'authentication')

  try {
    const response = await fetch(`/api/portal/${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
    const body = await response.json().catch(() => ({})) as { error?: string | { code?: PortalErrorCode; message?: string; stage?: string; status?: number; details?: string; hint?: string } }
    if (!response.ok) {
      const error = typeof body.error === 'object' ? body.error : undefined
      throw new PortalApiError(error?.message ?? (typeof body.error === 'string' ? body.error : 'The portal request failed.'), response.status, error?.code ?? 'NETWORK_ERROR', error?.stage ?? 'response', error?.details, error?.hint)
    }
    return body as T
  } catch (error) {
    if (error instanceof PortalApiError) throw error
    throw new PortalApiError('The portal could not connect. Please try again.', 0, 'NETWORK_ERROR', 'network')
  }
}

export async function portalFile(path: string): Promise<Response> {
  const supabase = await getPortalSupabase()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new PortalApiError('Your session has expired. Please sign in again.', 401, 'AUTHENTICATION_ERROR', 'authentication')

  const response = await fetch(`/api/portal/inspection-files/${path}`, {
    headers: { Accept: '*/*', Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: { code?: PortalErrorCode; message?: string; stage?: string } }
    throw new PortalApiError(body.error?.message ?? 'The inspection file could not be prepared.', response.status, body.error?.code ?? 'NETWORK_ERROR', body.error?.stage ?? 'inspection_file')
  }
  return response
}

export async function downloadPortalFile(path: string) {
  const response = await portalFile(path)
  const blob = await response.blob()
  const disposition = response.headers.get('content-disposition') ?? ''
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'Guardemar-download'
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
