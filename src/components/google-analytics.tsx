import { useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { hasConsent, subscribeToConsent } from '@/lib/consent'
import { initialiseGoogleAnalytics, setGoogleAnalyticsConsent, trackGoogleAnalyticsPageView } from '@/lib/gtag'

/** Loads Google Analytics 4 only while Analytics consent is present, and reports page views on client-side navigation. */
export function GoogleAnalytics() {
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false)
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const searchStr = useRouterState({ select: (state) => state.location.searchStr })

  useEffect(() => {
    const allowed = hasConsent('analytics')
    setAnalyticsAllowed(allowed)
    initialiseGoogleAnalytics(allowed)
    return subscribeToConsent((record) => {
      setAnalyticsAllowed(record.analytics)
      setGoogleAnalyticsConsent(record.analytics)
    })
  }, [])

  useEffect(() => {
    if (!analyticsAllowed) return
    trackGoogleAnalyticsPageView(`${pathname}${searchStr}`)
  }, [analyticsAllowed, pathname, searchStr])

  return null
}
