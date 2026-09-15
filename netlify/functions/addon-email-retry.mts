import type { Config } from '@netlify/functions'
import { checked, sendAddonAdminEmail } from './_addon-shared.mts'
import { serviceDatabase } from './_subscription-shared.mts'
export default async () => {
  const database = serviceDatabase()
  const pending = checked(await database.from('addon_request_email_delivery').select('request_id').is('sent_at', null).or(`first_attempt_at.is.null,first_attempt_at.gte.${new Date(Date.now() - 23 * 3600000).toISOString()}`).order('request_id').limit(5)) ?? []
  const results = await Promise.allSettled(pending.map((item) => sendAddonAdminEmail(database, item.request_id)))
  results.forEach((result, index) => { if (result.status === 'rejected') console.error('addon_admin_email_pending', { requestId: pending[index].request_id }) })
}
export const config: Config = { schedule: '*/5 * * * *' }
