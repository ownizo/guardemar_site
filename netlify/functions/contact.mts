import type { Config } from '@netlify/functions'
import { Resend } from 'resend'
import { z } from 'zod'

const MAX_BODY_BYTES = 32_000
const MIN_COMPLETION_MS = 2_000
const DEFAULT_NOTIFICATION_EMAIL = 'info@guardemar.com'
const DEFAULT_FROM_EMAIL = 'website@guardemar.com'

const optionalText = (maximum: number) => z.string().trim().max(maximum).optional().default('')

const enquirySchema = z.object({
  submission_id: z.string().uuid(),
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254),
  phone: optionalText(40),
  whatsapp: optionalText(40),
  country: optionalText(100),
  property_location: z.string().trim().min(2).max(160),
  property_type: z.string().trim().min(1).max(80),
  property_size: optionalText(80),
  pool: optionalText(20),
  garden: optionalText(20),
  occupancy: optionalText(80),
  visit_frequency: optionalText(160),
  inspection_frequency: optionalText(80),
  current_arrangements: optionalText(2_000),
  services: z.array(z.string().trim().min(1).max(100)).max(12).default([]),
  message: optionalText(5_000),
  source_page: optionalText(1_000),
  referrer: optionalText(1_000),
  utm_source: optionalText(200),
  utm_medium: optionalText(200),
  utm_campaign: optionalText(200),
  utm_content: optionalText(200),
  utm_term: optionalText(200),
  started_at: z.coerce.number().int().positive(),
  bot_field: optionalText(200),
})

export type Enquiry = z.infer<typeof enquirySchema>

type EmailMessage = {
  to?: string
  subject: string
  html: string
  text: string
  replyTo?: string
}

type EmailSender = (message: EmailMessage, idempotencyKey: string) => Promise<void>

type ContactDependencies = {
  now?: () => number
  sendNotification: EmailSender
  sendConfirmation: EmailSender
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function isAllowedOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return true

  try {
    const hostname = new URL(origin).hostname
    return hostname === 'guardemar.com'
      || hostname === 'www.guardemar.com'
      || hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname.endsWith('.netlify.app')
  } catch {
    return false
  }
}

function parseEnquiry(body: string) {
  const params = new URLSearchParams(body)
  return enquirySchema.safeParse({
    submission_id: params.get('submission_id') ?? '',
    first_name: params.get('first_name') ?? '',
    last_name: params.get('last_name') ?? '',
    email: params.get('email') ?? '',
    phone: params.get('phone') ?? '',
    whatsapp: params.get('whatsapp') ?? '',
    country: params.get('country') ?? '',
    property_location: params.get('property_location') ?? '',
    property_type: params.get('property_type') ?? '',
    property_size: params.get('property_size') ?? '',
    pool: params.get('pool') ?? '',
    garden: params.get('garden') ?? '',
    occupancy: params.get('occupancy') ?? '',
    visit_frequency: params.get('visit_frequency') ?? '',
    inspection_frequency: params.get('inspection_frequency') ?? '',
    current_arrangements: params.get('current_arrangements') ?? '',
    services: params.getAll('services'),
    message: params.get('message') ?? '',
    source_page: params.get('source_page') ?? '',
    referrer: params.get('referrer') ?? '',
    utm_source: params.get('utm_source') ?? '',
    utm_medium: params.get('utm_medium') ?? '',
    utm_campaign: params.get('utm_campaign') ?? '',
    utm_content: params.get('utm_content') ?? '',
    utm_term: params.get('utm_term') ?? '',
    started_at: params.get('started_at') ?? '',
    bot_field: params.get('bot-field') ?? '',
  })
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character)
}

function cleanSubjectValue(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function labelledRows(enquiry: Enquiry, submittedAt: string) {
  const rows: Array<[string, string]> = [
    ['Name', `${enquiry.first_name} ${enquiry.last_name}`],
    ['Email', enquiry.email],
    ['Telephone', enquiry.phone],
    ['WhatsApp', enquiry.whatsapp],
    ['Country of residence', enquiry.country],
    ['Property', enquiry.property_location],
    ['Property type', enquiry.property_type],
    ['Approximate property size', enquiry.property_size],
    ['Pool', enquiry.pool],
    ['Garden', enquiry.garden],
    ['Occupancy status', enquiry.occupancy],
    ['Owner visits Portugal', enquiry.visit_frequency],
    ['Preferred inspection frequency', enquiry.inspection_frequency],
    ['Current arrangements', enquiry.current_arrangements],
    ['Services', enquiry.services.join(', ')],
    ['Message', enquiry.message],
    ['Submission date', submittedAt],
    ['Source page', enquiry.source_page],
    ['Referrer', enquiry.referrer],
    ['UTM source', enquiry.utm_source],
    ['UTM medium', enquiry.utm_medium],
    ['UTM campaign', enquiry.utm_campaign],
    ['UTM content', enquiry.utm_content],
    ['UTM term', enquiry.utm_term],
  ]

  return rows.filter(([, value]) => value.trim().length > 0)
}

export function renderNotificationEmail(enquiry: Enquiry, submittedAt: string) {
  const rows = labelledRows(enquiry, submittedAt)
  const htmlRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding:8px 14px 8px 0;color:#568AA8;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;vertical-align:top;width:180px;">${escapeHtml(label)}</td>
      <td style="padding:8px 0;color:#172033;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;vertical-align:top;white-space:pre-wrap;">${escapeHtml(value)}</td>
    </tr>`).join('')

  return {
    html: `<!doctype html><html><body style="margin:0;padding:0;background:#f4f6f8;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f6f8;"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:680px;background:#ffffff;border:1px solid #dfe5ea;"><tr><td style="background:#06275A;padding:24px 28px;"><div style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;letter-spacing:2px;">GUARDEMAR</div><div style="color:#b8cfdd;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;margin-top:4px;">PRIVATE PROPERTY CARE</div></td></tr><tr><td style="padding:28px;"><div style="color:#568AA8;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.5px;">NEW PROPERTY CARE ENQUIRY</div><h1 style="color:#06275A;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1.25;margin:8px 0 20px;">New Property Care Enquiry</h1><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${htmlRows}</table><p style="border-top:1px solid #dfe5ea;color:#435064;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;margin:22px 0 0;padding-top:18px;">Reply directly to this email to contact the prospective customer.</p></td></tr></table></td></tr></table></body></html>`,
    text: `GUARDEMAR\nPRIVATE PROPERTY CARE\n\nNEW PROPERTY CARE ENQUIRY\n\n${rows.map(([label, value]) => `${label}:\n${value}`).join('\n\n')}\n\nReply directly to this email to contact the prospective customer.`,
  }
}

export function renderConfirmationEmail(firstName: string) {
  const safeFirstName = escapeHtml(firstName)
  return {
    html: `<!doctype html><html><body style="margin:0;padding:0;background:#f4f6f8;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#ffffff;border:1px solid #dfe5ea;"><tr><td style="background:#06275A;padding:24px 28px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:22px;font-weight:bold;letter-spacing:2px;">GUARDEMAR</div><div style="color:#b8cfdd;font-size:11px;letter-spacing:2px;margin-top:4px;">PRIVATE PROPERTY CARE</div></td></tr><tr><td style="padding:28px;color:#263247;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;"><p style="margin:0 0 16px;">Hi ${safeFirstName},</p><p>Thank you for contacting Guardemar.</p><p>We've received your enquiry and will review the information you've sent.</p><p>We'll get back to you as soon as possible regarding your property and the most suitable level of care.</p><p style="color:#06275A;font-weight:bold;margin:24px 0 0;">GUARDEMAR</p><p style="margin:0;">Private Property Care<br>Here when you're away.</p><p><a href="tel:+351928226570" style="color:#568AA8;">+351 928 226 570</a><br><a href="mailto:info@guardemar.com" style="color:#568AA8;">info@guardemar.com</a><br><a href="https://guardemar.com" style="color:#568AA8;">guardemar.com</a></p></td></tr></table></td></tr></table></body></html>`,
    text: `Hi ${firstName},\n\nThank you for contacting Guardemar.\n\nWe've received your enquiry and will review the information you've sent.\n\nWe'll get back to you as soon as possible regarding your property and the most suitable level of care.\n\nGUARDEMAR\nPrivate Property Care\nHere when you're away.\n\n+351 928 226 570\ninfo@guardemar.com\nguardemar.com`,
  }
}

export function createContactHandler(dependencies: ContactDependencies) {
  return async (request: Request) => {
    if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)
    if (!isAllowedOrigin(request)) {
      console.warn('contact_validation_failure', { reason: 'origin' })
      return jsonResponse({ error: 'Unable to accept this enquiry.' }, 403)
    }

    const contentType = request.headers.get('content-type') ?? ''
    if (!contentType.includes('application/x-www-form-urlencoded')) {
      console.warn('contact_validation_failure', { reason: 'content_type' })
      return jsonResponse({ error: 'Invalid form submission.' }, 415)
    }

    const declaredLength = Number(request.headers.get('content-length') ?? 0)
    if (declaredLength > MAX_BODY_BYTES) {
      console.warn('contact_validation_failure', { reason: 'payload_size' })
      return jsonResponse({ error: 'The enquiry is too large.' }, 413)
    }

    const body = await request.text()
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
      console.warn('contact_validation_failure', { reason: 'payload_size' })
      return jsonResponse({ error: 'The enquiry is too large.' }, 413)
    }

    const parsed = parseEnquiry(body)
    if (!parsed.success) {
      console.warn('contact_validation_failure', { reason: 'fields' })
      return jsonResponse({ error: 'Please check the required information and try again.' }, 400)
    }

    const enquiry = parsed.data
    const now = (dependencies.now ?? Date.now)()
    if (enquiry.bot_field || now - enquiry.started_at < MIN_COMPLETION_MS) {
      console.warn('contact_validation_failure', { reason: 'spam', submissionId: enquiry.submission_id })
      return jsonResponse({ error: 'Unable to accept this enquiry.' }, 400)
    }

    console.info('contact_submission_accepted', { submissionId: enquiry.submission_id })
    const submittedAt = new Date(now).toLocaleString('en-GB', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Europe/Lisbon',
    })
    const notification = renderNotificationEmail(enquiry, submittedAt)
    const propertyLocation = cleanSubjectValue(enquiry.property_location)

    try {
      await dependencies.sendNotification({
        replyTo: enquiry.email,
        subject: propertyLocation ? `New Guardemar enquiry — ${propertyLocation}` : 'New Guardemar website enquiry',
        ...notification,
      }, `guardemar-notification-${enquiry.submission_id}`)
      console.info('contact_notification_sent', { submissionId: enquiry.submission_id })
    } catch (error) {
      console.error('contact_email_provider_failure', {
        stage: 'notification',
        submissionId: enquiry.submission_id,
        error: error instanceof Error ? error.message : 'Unknown provider error',
      })
      return jsonResponse({ error: 'We could not send your enquiry just now.' }, 502)
    }

    const confirmation = renderConfirmationEmail(enquiry.first_name)
    try {
      await dependencies.sendConfirmation({
        to: enquiry.email,
        subject: "We've received your Guardemar enquiry",
        ...confirmation,
      }, `guardemar-confirmation-${enquiry.submission_id}`)
      console.info('contact_confirmation_sent', { submissionId: enquiry.submission_id })
    } catch (error) {
      console.error('contact_email_provider_failure', {
        stage: 'confirmation',
        submissionId: enquiry.submission_id,
        error: error instanceof Error ? error.message : 'Unknown provider error',
      })
    }

    return jsonResponse({ ok: true }, 200)
  }
}

export default async function handler(request: Request) {
  const apiKey = process.env.RESEND_API_KEY
  const notificationEmail = process.env.CONTACT_NOTIFICATION_EMAIL?.trim() || DEFAULT_NOTIFICATION_EMAIL
  const fromEmail = process.env.CONTACT_FROM_EMAIL?.trim() || DEFAULT_FROM_EMAIL

  if (!apiKey) {
    console.error('contact_email_provider_failure', { stage: 'configuration', error: 'RESEND_API_KEY is not configured' })
    return jsonResponse({ error: 'Email delivery is not configured.' }, 503)
  }

  const resend = new Resend(apiKey)
  const sendEmail: EmailSender = async (message, idempotencyKey) => {
    const result = await resend.emails.send({
      from: `Guardemar Website <${fromEmail}>`,
      to: message.to || notificationEmail,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo,
    }, { idempotencyKey })

    if (result.error) throw new Error(`${result.error.name}: ${result.error.message}`)
  }

  return createContactHandler({
    sendNotification: (message, key) => sendEmail({ ...message, to: notificationEmail }, key),
    sendConfirmation: sendEmail,
  })(request)
}

export const config: Config = {
  path: '/api/contact',
  method: 'POST',
  rateLimit: {
    action: 'rate_limit',
    aggregateBy: ['ip', 'domain'],
    windowLimit: 5,
    windowSize: 60,
  },
}
