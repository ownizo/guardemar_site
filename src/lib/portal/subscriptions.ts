import { getPortalSupabase } from './supabase'

export class SubscriptionApiError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message) }
}

export async function subscriptionApi<T>(path = '', init?: RequestInit): Promise<T> {
  const supabase = await getPortalSupabase()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new SubscriptionApiError('Your session has expired. Please sign in again.', 401, 'AUTHENTICATION_ERROR')
  const response = await fetch(`/api/subscriptions/${path}`, {
    ...init,
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  })
  const body = await response.json().catch(() => ({})) as { error?: { code?: string; message?: string } }
  if (!response.ok) throw new SubscriptionApiError(body.error?.message || 'The subscription request failed.', response.status, body.error?.code || 'REQUEST_ERROR')
  return body as T
}

export async function downloadSubscriptionTerms(version: string) {
  const supabase = await getPortalSupabase()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new SubscriptionApiError('Your session has expired. Please sign in again.', 401, 'AUTHENTICATION_ERROR')
  const response = await fetch(`/api/subscriptions/terms?version=${encodeURIComponent(version)}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new SubscriptionApiError('The accepted General Terms could not be downloaded.', response.status, 'TERMS_DOWNLOAD_ERROR')
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = `guardemar-general-terms-v${version}.md`
  link.click()
  URL.revokeObjectURL(url)
}

export type SubscriptionSummary = {
  id: string
  property_id: string
  plan_code: 'care' | 'care_plus' | 'complete'
  billing_interval: 'month' | 'year'
  currency: 'EUR'
  selected_net_amount: number
  tax_percentage: number
  tax_display_name: string
  tax_amount: number
  gross_amount: number
  contract_start_date: string | null
  contract_end_date: string | null
  renews_at: string | null
  local_status: string
  payment_status: string
  stripe_current_period_end: string | null
  created_at: string
  clients?: { first_name: string; last_name: string } | null
  properties: { display_name: string; locality: string; municipality: string } | null
  service_agreement_acceptances: { terms_version: string; accepted_at: string } | null
}
