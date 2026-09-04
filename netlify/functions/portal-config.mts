import type { Config } from '@netlify/functions'

export default async () => {
  const url = Netlify.env.get('SUPABASE_URL')
  const publishableKey = Netlify.env.get('SUPABASE_PUBLISHABLE_KEY')
  if (!url || !publishableKey) {
    return Response.json({ error: 'Portal authentication is not configured.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  if (new URL(url).hostname.split('.')[0] !== 'ablktbpledjceddessyg') {
    return Response.json({ error: 'Portal authentication is not configured for Guardemar.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  return Response.json({ url, publishableKey }, { headers: { 'Cache-Control': 'public, max-age=300' } })
}

export const config: Config = { path: '/api/portal-config', method: 'GET' }
