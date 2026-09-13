import { googleAnalyticsMeasurementId } from '@/config/analytics'

type GtagFunction = (...args: unknown[]) => void
type GtagWindow = Window & { dataLayer?: unknown[]; gtag?: GtagFunction }

const SCRIPT_ELEMENT_ID = 'google-analytics-gtag'

let configured = false

function ensureGtag(): GtagFunction {
  const target = window as GtagWindow
  target.dataLayer = target.dataLayer ?? []
  if (!target.gtag) {
    target.gtag = function gtag() {
      target.dataLayer?.push(arguments)
    }
  }
  return target.gtag
}

function loadGtagScript() {
  if (document.getElementById(SCRIPT_ELEMENT_ID)) return
  const script = document.createElement('script')
  script.id = SCRIPT_ELEMENT_ID
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsMeasurementId}`
  document.head.appendChild(script)
}

/** Queues the Google tag configuration with storage denied by default, then applies the stored consent choice. */
export function initialiseGoogleAnalytics(analyticsAllowed: boolean) {
  if (typeof window === 'undefined') return
  const gtag = ensureGtag()
  if (!configured) {
    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
    })
    gtag('js', new Date())
    gtag('config', googleAnalyticsMeasurementId, { send_page_view: false, anonymize_ip: true })
    configured = true
  }
  setGoogleAnalyticsConsent(analyticsAllowed)
}

/** Grants or withdraws analytics storage. The Google tag itself is only requested once consent exists. */
export function setGoogleAnalyticsConsent(analyticsAllowed: boolean) {
  if (typeof window === 'undefined') return
  ensureGtag()('consent', 'update', { analytics_storage: analyticsAllowed ? 'granted' : 'denied' })
  if (analyticsAllowed) loadGtagScript()
}

export function trackGoogleAnalyticsPageView(path: string) {
  if (typeof window === 'undefined') return
  ;(window as GtagWindow).gtag?.('event', 'page_view', { page_path: path, page_location: window.location.href, page_title: document.title })
}

export function trackGoogleAnalyticsEvent(event: string, parameters: Record<string, string> = {}) {
  if (typeof window === 'undefined') return
  ;(window as GtagWindow).gtag?.('event', event, parameters)
}
