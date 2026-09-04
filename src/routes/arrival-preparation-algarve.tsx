import { createFileRoute } from '@tanstack/react-router'
import { DeepServicePage } from '@/components/service-page'
import { servicePages } from '@/config/services'
import { pageHead } from '@/lib/seo'
const service = servicePages['arrival-preparation-algarve']
export const Route = createFileRoute('/arrival-preparation-algarve')({ head: () => pageHead({ title: service.seoTitle, description: service.description, path: `/${service.slug}/` }), component: () => <DeepServicePage service={service} /> })
