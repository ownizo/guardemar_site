import { hasConsent } from '@/lib/consent'

export type AnalyticsEvent = 'assessment_form_start' | 'assessment_form_submit' | 'phone_click' | 'email_click' | 'whatsapp_click' | 'plan_cta_click' | 'service_cta_click' | 'area_page_cta' | 'blog_cta'

export function trackEvent(event: AnalyticsEvent, parameters: Record<string, string> = {}) {
  if (typeof window === 'undefined' || !hasConsent('analytics')) return
  const dataLayer = (window as Window & { dataLayer?: unknown[] }).dataLayer
  dataLayer?.push({ event, ...parameters })
  window.dispatchEvent(new CustomEvent('guardemar:analytics', { detail: { event, parameters } }))
}
