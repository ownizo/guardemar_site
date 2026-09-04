import { createFileRoute } from '@tanstack/react-router'
import { ForgotPasswordCard } from '@/components/portal/auth'

export const Route = createFileRoute('/portal/forgot-password')({
  head: () => ({ meta: [{ title: 'Reset Password | GUARDEMAR' }, { name: 'robots', content: 'noindex, nofollow' }] }),
  component: ForgotPasswordCard,
})
