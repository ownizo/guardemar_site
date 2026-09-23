import { createFileRoute } from '@tanstack/react-router'
import { DeepServicePage } from '@/components/service-page'
import { servicePages } from '@/config/services'
import { pageHead } from '@/lib/seo'
const service = servicePages['holiday-home-checks-algarve']
export const Route = createFileRoute('/holiday-home-checks-algarve')({ head: () => pageHead({ title: service.seoTitle, description: service.description, path: `/${service.slug}/`, canonicalPath: '/home-watch-algarve/', noindex: true }), component: () => <DeepServicePage service={service} /> })
