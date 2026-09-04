export const CONSENT_VERSION = '1'
export const CONSENT_STORAGE_KEY = 'guardemar_cookie_consent'

export const cookieCategories = {
  necessary: {
    title: 'Strictly Necessary',
    description: 'Required for essential website functions, security and remembering your privacy choices.',
  },
  analytics: {
    title: 'Analytics',
    description: 'Helps us understand how the website is used. No analytics provider is currently configured.',
  },
} as const

export const optionalFirstPartyCookieNames: string[] = []
