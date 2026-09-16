import { createFileRoute } from '@tanstack/react-router'
import { PrivateGuard } from '@/components/portal/auth'
import { AddonRequestDetail } from '@/components/portal/addon-management'
export const Route = createFileRoute('/portal/services_/requests/$id')({ head: () => ({ meta: [{ title: 'Your service request | GUARDEMAR' }, { name: 'robots', content: 'noindex, nofollow' }] }), component: Page })
function Page() {
  const { id } = Route.useParams()
  return <PrivateGuard area="portal">{(profile) => <AddonRequestDetail profile={profile} id={id} />}</PrivateGuard>
}
