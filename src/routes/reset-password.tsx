import { createFileRoute } from '@tanstack/react-router'
import { ResetPasswordCard } from '@/components/portal/auth'

export const Route = createFileRoute('/reset-password')({
  head: () => ({ meta: [{ title: 'Choose a New Password | GUARDEMAR' }, { name: 'robots', content: 'noindex, nofollow' }] }),
  component: ResetPasswordCard,
})
