import assert from 'node:assert/strict'
import test from 'node:test'

import { createContactHandler, renderNotificationEmail, type Enquiry } from '../netlify/functions/contact.mts'

const now = Date.UTC(2026, 8, 4, 12, 0, 0)

function validBody(overrides: Record<string, string | string[]> = {}) {
  const fields: Record<string, string | string[]> = {
    submission_id: '44e40ce9-fb22-4b37-91dc-6060ee032be8',
    first_name: 'Ana',
    last_name: 'Silva',
    email: 'ana@example.com',
    property_location: 'Lagos',
    property_type: 'Villa',
    message: 'Please contact me about regular inspections.',
    services: ['Scheduled inspections', 'Key holding'],
    started_at: String(now - 10_000),
    source_page: 'https://guardemar.com/contact/?utm_source=google',
    utm_source: 'google',
    ...overrides,
  }
  const params = new URLSearchParams()
  for (const [name, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) params.append(name, item)
  }
  return params.toString()
}

function request(body: string) {
  return new Request('https://guardemar.com/api/contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: 'https://guardemar.com',
    },
    body,
  })
}

test('accepts a valid enquiry and sends both emails', async () => {
  const notifications: Array<{ message: Record<string, unknown>, key: string }> = []
  const confirmations: Array<{ message: Record<string, unknown>, key: string }> = []
  const handler = createContactHandler({
    now: () => now,
    sendNotification: async (message, key) => { notifications.push({ message, key }) },
    sendConfirmation: async (message, key) => { confirmations.push({ message, key }) },
  })

  const response = await handler(request(validBody()))

  assert.equal(response.status, 200)
  assert.equal(notifications.length, 1)
  assert.equal(confirmations.length, 1)
  assert.equal(notifications[0].message.replyTo, 'ana@example.com')
  assert.equal(notifications[0].message.subject, 'New Guardemar enquiry — Lagos')
  assert.equal(confirmations[0].message.to, 'ana@example.com')
  assert.match(String(notifications[0].message.html), /Scheduled inspections, Key holding/)
  assert.match(String(notifications[0].message.html), /UTM source/)
})

test('rejects an invalid email without sending', async () => {
  let sends = 0
  const handler = createContactHandler({
    now: () => now,
    sendNotification: async () => { sends += 1 },
    sendConfirmation: async () => { sends += 1 },
  })

  const response = await handler(request(validBody({ email: 'not-an-email' })))

  assert.equal(response.status, 400)
  assert.equal(sends, 0)
})

test('rejects missing required information without sending', async () => {
  let sends = 0
  const handler = createContactHandler({
    now: () => now,
    sendNotification: async () => { sends += 1 },
    sendConfirmation: async () => { sends += 1 },
  })

  const response = await handler(request(validBody({ property_location: '' })))

  assert.equal(response.status, 400)
  assert.equal(sends, 0)
})

test('returns failure when the notification provider fails', async () => {
  const handler = createContactHandler({
    now: () => now,
    sendNotification: async () => { throw new Error('sandbox provider failure') },
    sendConfirmation: async () => { assert.fail('confirmation must not send') },
  })

  const response = await handler(request(validBody()))

  assert.equal(response.status, 502)
  assert.deepEqual(await response.json(), { error: 'We could not send your enquiry just now.' })
})

test('rejects the honeypot without sending', async () => {
  let sends = 0
  const handler = createContactHandler({
    now: () => now,
    sendNotification: async () => { sends += 1 },
    sendConfirmation: async () => { sends += 1 },
  })

  const response = await handler(request(validBody({ 'bot-field': 'spam' })))

  assert.equal(response.status, 400)
  assert.equal(sends, 0)
})

test('notification email omits empty optional fields', () => {
  const enquiry = {
    submission_id: '44e40ce9-fb22-4b37-91dc-6060ee032be8',
    first_name: 'Ana',
    last_name: 'Silva',
    email: 'ana@example.com',
    property_location: 'Lagos',
    property_type: 'Villa',
    phone: '',
    whatsapp: '',
    country: '',
    property_size: '',
    pool: '',
    garden: '',
    occupancy: '',
    visit_frequency: '',
    inspection_frequency: '',
    current_arrangements: '',
    services: [],
    message: '',
    source_page: '',
    referrer: '',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_content: '',
    utm_term: '',
    started_at: now - 10_000,
    bot_field: '',
  } as Enquiry

  const email = renderNotificationEmail(enquiry, '4 September 2026 at 13:00')

  assert.doesNotMatch(email.html, /Telephone/)
  assert.match(email.html, /Property type/)
})
