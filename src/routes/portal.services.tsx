import { createFileRoute } from '@tanstack/react-router'
import { PrivateGuard } from '@/components/portal/auth'
import { CustomerServices } from '@/components/portal/addon-services'
export const Route = createFileRoute('/portal/services')({ head: () => ({ meta: [{ title: 'Services | GUARDEMAR' }, { name: 'robots', content: 'noindex, nofollow' }] }), component: Page })
function Page() {

  return <PrivateGuard area="portal">{(profile) => <CustomerServices profile={profile} />}</PrivateGuard>
}
