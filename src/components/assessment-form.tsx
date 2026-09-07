import { Send } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'

import { trackEvent } from '@/lib/analytics'

export function AssessmentForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle')
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
    const formData = new FormData(event.currentTarget)
    const currentUrl = new URL(window.location.href)
    submissionId.current ||= crypto.randomUUID()
    startedAt.current ||= Date.now()
    formData.set('submission_id', submissionId.current)
    formData.set('started_at', String(startedAt.current))
    formData.set('source_page', currentUrl.href)
    formData.set('referrer', document.referrer)
    for (const field of ['source', 'medium', 'campaign', 'content', 'term']) formData.set(`utm_${field}`, currentUrl.searchParams.get(`utm_${field}`) ?? '')
    const body = new URLSearchParams(formData as never).toString()

    try {
      const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
      if (!response.ok) throw new Error()
      trackEvent('assessment_form_submit')
      fetch('/__forms.html', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }).catch(() => console.warn('Netlify form backup storage failed.'))
      window.location.assign('/contact/thank-you/')
    } catch {
      setStatus('error')
    }
  }

  return <form className="assessment-form" name="property-assessment" method="POST" data-netlify="true" netlify-honeypot="bot-field" onSubmit={submit} onFocus={noteStart}>
    <input type="hidden" name="form-name" value="property-assessment" />
    <input type="hidden" name="subject" value="New Guardemar property assessment enquiry" />
    <p className="hidden-field"><label>Leave this field empty<input name="bot-field" /></label></p>
    <p className="required-note"><span aria-hidden="true">*</span> Required fields</p>
    <div className="form-grid two">
      <label>First name <span aria-hidden="true">*</span><input name="first_name" autoComplete="given-name" required /></label>
      <label>Last name <span aria-hidden="true">*</span><input name="last_name" autoComplete="family-name" required /></label>
    </div>
    <div className="form-grid two">
      <label>Email <span aria-hidden="true">*</span><input name="email" type="email" autoComplete="email" required /></label>
      <label>Phone / WhatsApp<input name="phone" type="tel" autoComplete="tel" /></label>
    </div>
    <div className="form-grid two">
      <label>Property location <span aria-hidden="true">*</span><input name="property_location" required placeholder="Town or area" /></label>
      <label>Property type <span aria-hidden="true">*</span><select name="property_type" required defaultValue=""><option value="" disabled>Select</option><option>Apartment</option><option>Townhouse</option><option>Villa</option><option>Estate / large property</option><option>Other</option></select></label>
    </div>
    <label>Message<textarea name="message" rows={5} placeholder="Tell us what you need help with." /></label>
    <p className="form-privacy-notice">By submitting this form, you ask Guardemar to contact you about your enquiry. Your information is handled in accordance with our <a href="/privacy-policy/">Privacy Policy</a>.</p>
    <p className="response-commitment">Guardemar reviews every enquiry personally and replies with next steps as soon as practical.</p>
    <button className="button primary" disabled={status === 'sending'}>{status === 'sending' ? 'Sending…' : <>Request my assessment <Send size={16} /></>}</button>
    <div aria-live="polite">{status === 'error' && <p className="form-error">We couldn&apos;t send your enquiry just now. Please try again or contact us directly at <a href="mailto:info@guardemar.com">info@guardemar.com</a> or <a href="tel:+351928226570">+351 928 226 570</a>.</p>}</div>
  </form>
}
