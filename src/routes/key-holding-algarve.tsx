import { createFileRoute } from '@tanstack/react-router'
import { DeepServicePage } from '@/components/service-page'
import { servicePages } from '@/config/services'
const service = servicePages['key-holding-algarve']
export const Route = createFileRoute('/key-holding-algarve')({ head: () => ({ meta: [{ title: service.seoTitle }, { name: 'description', content: service.description }], links: [{ rel: 'canonical', href: `https://guardemar.com/${service.slug}/` }] }), component: () => <DeepServicePage service={service} /> })
