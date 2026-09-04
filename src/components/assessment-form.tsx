import { Send } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'

import { trackEvent } from '@/lib/analytics'

const serviceOptions = ['Scheduled inspections', 'Key holding', 'Arrival preparation', 'Property handover', 'Contractor coordination', 'Storm check', 'Other']

export function AssessmentForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const started = useRef(false)
  const startedAt = useRef<number | null>(null)
  const submissionId = useRef<string | null>(null)

  function noteStart() {
    if (!started.current) {
      started.current = true
      startedAt.current = Date.now()
      trackEvent('assessment_form_start')
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('sending')
    const form = event.currentTarget
    const formData = new FormData(form)
    const currentUrl = new URL(window.location.href)
    submissionId.current ||= crypto.randomUUID()
    startedAt.current ||= Date.now()
    formData.set('submission_id', submissionId.current)
    formData.set('started_at', String(startedAt.current))
    formData.set('source_page', currentUrl.href)
    formData.set('referrer', document.referrer)
    for (const field of ['source', 'medium', 'campaign', 'content', 'term']) {
      formData.set(`utm_${field}`, currentUrl.searchParams.get(`utm_${field}`) ?? '')
    }
    const body = new URLSearchParams(formData as never).toString()

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      if (!response.ok) throw new Error()
      setStatus('success')
      trackEvent('assessment_form_submit')
      form.reset()
      started.current = false
      startedAt.current = null
      submissionId.current = null

      fetch('/__forms.html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      }).catch(() => console.warn('Netlify form backup storage failed.'))
    } catch {
      setStatus('error')
    }
  }

  return <form className="assessment-form" name="property-assessment" method="POST" data-netlify="true" netlify-honeypot="bot-field" onSubmit={submit} onFocus={noteStart}>
    <input type="hidden" name="form-name" value="property-assessment" />
    <input type="hidden" name="subject" value="New Guardemar property assessment enquiry" />
    <input type="hidden" name="submission_id" />
    <input type="hidden" name="started_at" />
    <input type="hidden" name="source_page" />
    <input type="hidden" name="referrer" />
    <input type="hidden" name="utm_source" />
    <input type="hidden" name="utm_medium" />
    <input type="hidden" name="utm_campaign" />
    <input type="hidden" name="utm_content" />
    <input type="hidden" name="utm_term" />
    <p className="honeypot"><label>Leave this empty<input name="bot-field" /></label></p>
    <div className="form-grid">
      <label>First name<input name="first_name" required autoComplete="given-name" /></label>
      <label>Last name<input name="last_name" required autoComplete="family-name" /></label>
      <label>Email<input name="email" type="email" required autoComplete="email" /></label>
      <label>Phone<input name="phone" type="tel" autoComplete="tel" /></label>
      <label>WhatsApp<input name="whatsapp" type="tel" /></label>
      <label>Country of residence<input name="country" autoComplete="country-name" /></label>
      <label>Property location<input name="property_location" required /></label>
      <label>Property type<select name="property_type" required defaultValue=""><option value="" disabled>Select</option><option>Apartment</option><option>Townhouse</option><option>Villa</option><option>Villa with pool</option><option>Other</option></select></label>
      <label>Approximate property size<input name="property_size" placeholder="e.g. 180 m²" /></label>
      <label>Pool?<select name="pool"><option>No</option><option>Yes</option></select></label>
      <label>Garden?<select name="garden"><option>No</option><option>Yes</option></select></label>
      <label>Current occupancy<select name="occupancy"><option>Vacant</option><option>Occasionally occupied</option><option>Currently occupied</option></select></label>
      <label>How often are you in Portugal?<input name="visit_frequency" /></label>
      <label>Preferred inspection frequency<select name="inspection_frequency"><option>Not sure</option><option>Monthly</option><option>Twice monthly</option><option>Weekly</option></select></label>
    </div>
    <label>Current property management arrangements<textarea name="current_arrangements" rows={3} /></label>
    <fieldset><legend>Services required</legend><div className="checkbox-grid">{serviceOptions.map((option) => <label key={option}><input type="checkbox" name="services" value={option} />{option}</label>)}</div></fieldset>
    <label>Message<textarea name="message" rows={5} placeholder="Tell us about the property and what would help." /></label>
    <p className="form-privacy-notice">By submitting this form, you ask Guardemar to contact you about your enquiry. Your information is handled in accordance with our <a href="/privacy-policy/">Privacy Policy</a>.</p>
    <button className="button primary" disabled={status === 'sending'}>{status === 'sending' ? 'Sending…' : <>Request my assessment <Send size={16} /></>}</button>
    <div aria-live="polite">{status === 'success' && <div className="form-success"><p>Thank you. Your enquiry has been sent to Guardemar.</p><p>We'll review the information and get back to you shortly.</p></div>}{status === 'error' && <p className="form-error">We couldn't send your enquiry just now. Please try again or contact us directly at <a href="mailto:info@guardemar.com">info@guardemar.com</a> or <a href="tel:+351928226570">+351 928 226 570</a>.</p>}</div>
  </form>
}
