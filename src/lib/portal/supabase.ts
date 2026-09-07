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
          // Callback processing is explicit and owned entirely by /auth/callback (see
          // src/lib/portal/auth-callback.ts). The SDK's automatic URL detection swallows
          // the real Supabase error (a flow-type mismatch, an expired code, a failed OTP
          // verification) and simply leaves no session behind, which every other page
          // then misreports as "link invalid" regardless of the true cause. Every page
          // that constructs this client — including /auth/callback itself — must call
          // supabase.auth.getSession()/verifyOtp()/exchangeCodeForSession() deliberately.
          detectSessionInUrl: false,
          flowType: 'pkce',
        },
      }))
  }
  return portalClient
}
