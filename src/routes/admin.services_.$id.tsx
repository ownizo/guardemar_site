import { createFileRoute } from '@tanstack/react-router'
import { PrivateGuard } from '@/components/portal/auth'
import { AddonRequestDetail } from '@/components/portal/addon-management'
export const Route = createFileRoute('/admin/services_/$id')({ head: () => ({ meta: [{ title: 'Review service request | GUARDEMAR' }, { name: 'robots', content: 'noindex, nofollow' }] }), component: Page })
function Page() {
  const { id } = Route.useParams()
  return <PrivateGuard area="admin">{(profile) => <AddonRequestDetail profile={profile} id={id} admin />}</PrivateGuard>
}
