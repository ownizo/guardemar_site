import { useState, type FormEvent } from 'react'

const serviceOptions = ['Scheduled inspections', 'Key holding', 'Arrival preparation', 'Property handover', 'Contractor coordination', 'Storm check', 'Other']

export function AssessmentDetailsForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('sending')
    const body = new URLSearchParams(new FormData(event.currentTarget) as never).toString()
    try {
      const response = await fetch('/__forms.html', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
      if (!response.ok) throw new Error()
      event.currentTarget.reset()
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  return <form className="assessment-form" name="property-assessment-details" method="POST" data-netlify="true" netlify-honeypot="bot-field" onSubmit={submit}>
    <input type="hidden" name="form-name" value="property-assessment-details" />
    <p className="hidden-field"><label>Leave this field empty<input name="bot-field" /></label></p>
    <div className="form-grid two"><label>Email <span aria-hidden="true">*</span><input name="email" type="email" required /></label><label>Property location <span aria-hidden="true">*</span><input name="property_location" required /></label></div>
    <div className="form-grid two"><label>Approximate size<input name="property_size" /></label><label>Occupancy pattern<input name="occupancy" placeholder="For example, vacant for several months" /></label></div>
    <div className="form-grid two"><label>Pool<select name="pool"><option>No</option><option>Yes</option><option>Shared</option></select></label><label>Garden<select name="garden"><option>No</option><option>Yes</option><option>Shared</option></select></label></div>
    <div className="form-grid two"><label>How often do you visit?<input name="visit_frequency" /></label><label>Preferred inspection frequency<select name="inspection_frequency"><option>Not sure</option><option>Monthly</option><option>Twice monthly</option><option>Weekly</option></select></label></div>
    <label>Current arrangements<textarea name="current_arrangements" rows={4} /></label>
    <fieldset><legend>Services to discuss</legend><div className="checkbox-grid">{serviceOptions.map(option=><label key={option}><input type="checkbox" name="services" value={option}/>{option}</label>)}</div></fieldset>
    <button className="button primary" disabled={status==='sending'}>{status==='sending'?'Sending…':'Send property details'}</button>
    <div aria-live="polite">{status==='success'&&<p className="form-success">Thank you. The additional property details have been received.</p>}{status==='error'&&<p className="form-error">The details could not be sent. Please try again or send them through WhatsApp.</p>}</div>
  </form>
}
