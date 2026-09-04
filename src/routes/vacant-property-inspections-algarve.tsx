import { createFileRoute } from '@tanstack/react-router'
import { DeepServicePage } from '@/components/service-page'
import { servicePages } from '@/config/services'
import { pageHead } from '@/lib/seo'
const service = servicePages['vacant-property-inspections-algarve']
export const Route = createFileRoute('/vacant-property-inspections-algarve')({ head: () => pageHead({ title: service.seoTitle, description: service.description, path: `/${service.slug}/` }), component: () => <DeepServicePage service={service} /> })
