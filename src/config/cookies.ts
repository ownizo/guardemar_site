import { googleAnalyticsCookieNames, googleAnalyticsMeasurementId } from '@/config/analytics'

export const CONSENT_VERSION = '2'
export const CONSENT_STORAGE_KEY = 'guardemar_cookie_consent'

export const cookieCategories = {
  necessary: {
    title: 'Strictly Necessary',
    description: 'Required for essential website functions, security and remembering your privacy choices.',
  },
  analytics: {
    title: 'Analytics',
    description: `Helps us understand how the website is used. Loads Google Analytics 4 (measurement ID ${googleAnalyticsMeasurementId}) and its ${googleAnalyticsCookieNames.slice(0, 2).join(' and ')} cookies only after you allow this category, and lets our own visit counter keep a random session identifier to group the pages of one visit.`,
  },
} as const

export const optionalFirstPartyCookieNames: string[] = [...googleAnalyticsCookieNames]
