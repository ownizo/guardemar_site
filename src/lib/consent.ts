import { CONSENT_STORAGE_KEY, CONSENT_VERSION, optionalFirstPartyCookieNames } from '@/config/cookies'

export type OptionalConsentCategory = 'analytics'

export type ConsentRecord = {
  version: string
  necessary: true
  analytics: boolean
  updatedAt: string
}

const CONSENT_CHANGE_EVENT = 'guardemar:consent-change'
const CONSENT_SETTINGS_EVENT = 'guardemar:consent-settings'

function isConsentRecord(value: unknown): value is ConsentRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<ConsentRecord>
  return record.version === CONSENT_VERSION && record.necessary === true && typeof record.analytics === 'boolean' && typeof record.updatedAt === 'string'
}

export function getConsent(): ConsentRecord | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!stored) return null
    const parsed: unknown = JSON.parse(stored)
    return isConsentRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveConsent(analytics: boolean): ConsentRecord {
  const record: ConsentRecord = {
    version: CONSENT_VERSION,
    necessary: true,
    analytics,
    updatedAt: new Date().toISOString(),
  }
  window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record))
  if (!analytics) removeOptionalFirstPartyCookies()
  window.dispatchEvent(new CustomEvent<ConsentRecord>(CONSENT_CHANGE_EVENT, { detail: record }))
  return record
}

export function hasConsent(category: OptionalConsentCategory) {
  return getConsent()?.[category] === true
}

export function subscribeToConsent(listener: (record: ConsentRecord) => void) {
  if (typeof window === 'undefined') return () => undefined
  const handler = (event: Event) => listener((event as CustomEvent<ConsentRecord>).detail)
  window.addEventListener(CONSENT_CHANGE_EVENT, handler)
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, handler)
}

export function openCookieSettings() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CONSENT_SETTINGS_EVENT))
}

export function subscribeToCookieSettings(listener: () => void) {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener(CONSENT_SETTINGS_EVENT, listener)
  return () => window.removeEventListener(CONSENT_SETTINGS_EVENT, listener)
}

function removeOptionalFirstPartyCookies() {
  if (typeof document === 'undefined') return
  for (const name of optionalFirstPartyCookieNames) {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`
    document.cookie = `${name}=; Max-Age=0; Path=/; Domain=${window.location.hostname}; SameSite=Lax`
  }
}
