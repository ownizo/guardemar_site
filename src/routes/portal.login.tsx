import { createFileRoute } from '@tanstack/react-router'
import { AuthCard } from '@/components/portal/auth'

export const Route = createFileRoute('/portal/login')({
  head: () => ({ meta: [{ title: 'Client Login | GUARDEMAR' }, { name: 'robots', content: 'noindex, nofollow' }] }),
  component: () => <AuthCard area="portal" />,
})
