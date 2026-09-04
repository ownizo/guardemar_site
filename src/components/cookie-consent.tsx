import { X } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

import { cookieCategories } from '@/config/cookies'
import { getConsent, saveConsent, subscribeToConsent, subscribeToCookieSettings, type ConsentRecord } from '@/lib/consent'

export function CookieConsent() {
  const [ready, setReady] = useState(false)
  const [consent, setConsent] = useState<ConsentRecord | null>(null)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const current = getConsent()
    setConsent(current)
    setAnalytics(current?.analytics ?? false)
    setReady(true)
    const unsubscribeConsent = subscribeToConsent((record) => {
      setConsent(record)
      setAnalytics(record.analytics)
    })
    const unsubscribeSettings = subscribeToCookieSettings(() => openPreferences())
    return () => {
      unsubscribeConsent()
      unsubscribeSettings()
    }
  }, [])

  useEffect(() => {
    if (!preferencesOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('button, input, a')?.focus())
    return () => {
      document.body.style.overflow = previousOverflow
      restoreFocusRef.current?.focus()
    }
  }, [preferencesOpen])

  function openPreferences() {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const current = getConsent()
    setAnalytics(current?.analytics ?? false)
    setPreferencesOpen(true)
  }

  function choose(allowAnalytics: boolean) {
    const record = saveConsent(allowAnalytics)
    setConsent(record)
    setPreferencesOpen(false)
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setPreferencesOpen(false)
      return
    }
    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href]'))
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  if (!ready) return null

  return <>
    {!consent && !preferencesOpen && <section className="cookie-banner" aria-label="Cookie consent">
      <div className="cookie-banner-copy">
        <p className="cookie-kicker">Your privacy matters</p>
        <p>We use essential technologies to make this website work. With your permission, we may also use analytics or other optional technologies to understand how the site is used and improve Guardemar.</p>
        <p>You can accept optional cookies, reject them, or choose your preferences. Read our <a href="/cookie-policy/">Cookie Policy</a>.</p>
      </div>
      <div className="cookie-actions">
        <button className="cookie-button primary" type="button" onClick={() => choose(true)}>Accept all</button>
        <button className="cookie-button secondary" type="button" onClick={() => choose(false)}>Reject optional</button>
        <button className="cookie-button text" type="button" onClick={openPreferences}>Manage preferences</button>
      </div>
    </section>}

    {preferencesOpen && <div className="cookie-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreferencesOpen(false) }}>
      <div className="cookie-modal" role="dialog" aria-modal="true" aria-labelledby="cookie-settings-title" aria-describedby="cookie-settings-description" ref={dialogRef} onKeyDown={handleDialogKeyDown}>
        <div className="cookie-modal-heading">
          <div><p className="cookie-kicker">Privacy controls</p><h2 id="cookie-settings-title">Cookie preferences</h2></div>
          <button className="cookie-close" type="button" onClick={() => setPreferencesOpen(false)} aria-label="Close cookie preferences"><X size={20} /></button>
        </div>
        <p id="cookie-settings-description">Choose whether Guardemar may make optional analytics events available. You can change this choice at any time.</p>
        <div className="cookie-category">
          <div><h3>{cookieCategories.necessary.title}</h3><p>{cookieCategories.necessary.description}</p></div>
          <span className="cookie-required" aria-label="Strictly Necessary is always enabled">Always enabled</span>
        </div>
        <label className="cookie-category cookie-toggle-row">
          <div><h3>{cookieCategories.analytics.title}</h3><p>{cookieCategories.analytics.description}</p></div>
          <span className="cookie-toggle"><input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} /><span aria-hidden="true" /></span>
        </label>
        <div className="cookie-modal-actions">
          <button className="cookie-button primary" type="button" onClick={() => choose(analytics)}>Save preferences</button>
          <button className="cookie-button secondary" type="button" onClick={() => choose(true)}>Accept all</button>
          <button className="cookie-button secondary" type="button" onClick={() => choose(false)}>Reject optional</button>
        </div>
        <p className="cookie-policy-link">More detail is available in our <a href="/cookie-policy/" onClick={() => setPreferencesOpen(false)}>Cookie Policy</a>.</p>
      </div>
    </div>}
  </>
}
