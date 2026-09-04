import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let portalClient: Promise<SupabaseClient> | undefined

export function getPortalSupabase() {
  if (!portalClient) {
    portalClient = fetch('/api/portal-config', { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error('Portal authentication is unavailable.')
        return response.json() as Promise<{ url: string; publishableKey: string }>
      })
      .then(({ url, publishableKey }) => createClient(url, publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      }))
  }
  return portalClient
}
