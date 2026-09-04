import { createFileRoute } from '@tanstack/react-router'
import { AuthCard } from '@/components/portal/auth'
export const Route = createFileRoute('/admin/login')({ head: () => ({ meta: [{ title: 'Team Login | GUARDEMAR' }, { name: 'robots', content: 'noindex, nofollow' }] }), component: () => <AuthCard area="admin" /> })
