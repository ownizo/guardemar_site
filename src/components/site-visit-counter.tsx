import { useRouterState } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

import { hasConsent } from '@/lib/consent'

/**
 * Cookieless visit counter for the Ownizo CRM (admin.adlerrochefort.com → Site visits).
 *
 * Each public page view sends the page path, the referrer and campaign parameters to
 * /api/site-track; the server adds the country and device type and drops bots. No IP
 * address or user-agent string is stored, and nothing is written to the device unless
 * Analytics consent is given (then a random session identifier is kept in sessionStorage
 * so that pages from the same visit are grouped).
 *
 * To stop counting your own visits, open guardemar.com/?nao-contar=1 once on each device.
 */

const ENDPOINT = 'https://admin.adlerrochefort.com/api/site-track'
const HOST = 'guardemar.com'
const OPT_OUT_KEY = 'guardemar_visit_counter_off'
const SESSION_KEY = 'guardemar_visit_session'

function randomId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
}

function optedOut() {
  try {
    const flag = new URLSearchParams(window.location.search).get('nao-contar')
    if (flag === '1') window.localStorage.setItem(OPT_OUT_KEY, '1')
    if (flag === '0') window.localStorage.removeItem(OPT_OUT_KEY)
    return window.localStorage.getItem(OPT_OUT_KEY) === '1'
  } catch {
    return false
  }
}

function sessionId() {
  if (!hasConsent('analytics')) return null
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = randomId()
      window.sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

function send(payload: Record<string, unknown>, beacon = false) {
  const body = JSON.stringify(payload)
  try {
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }))
      return
    }
    void fetch(ENDPOINT, { method: 'POST', body, keepalive: true, mode: 'cors', headers: { 'Content-Type': 'text/plain' } }).catch(() => undefined)
  } catch {
    // A counter must never affect the page.
  }
}

export function SiteVisitCounter() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const current = useRef<{ visitId: string; started: number; url: string } | null>(null)
  const previousUrl = useRef<string | null>(null)

  useEffect(() => {
    if (window.location.hostname.replace(/^www\./, '') !== HOST) return
    if (optedOut() || (navigator as Navigator & { webdriver?: boolean }).webdriver) return

    const end = () => {
      const visit = current.current
      if (!visit) return
      current.current = null
      send({ action: 'visit-end', visitId: visit.visitId, url: visit.url, durationSeconds: (Date.now() - visit.started) / 1000 }, true)
    }

    // Client-side navigation: close the previous page view before counting the new one.
    end()
    const url = window.location.href
    const visitId = randomId()
    current.current = { visitId, started: Date.now(), url }
    send({ action: 'visit-start', visitId, sessionId: sessionId(), path: pathname, url, referrer: previousUrl.current ?? document.referrer })
    previousUrl.current = url

    const onHidden = () => {
      if (document.visibilityState === 'hidden') end()
    }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', end)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', end)
    }
  }, [pathname])

  return null
}
