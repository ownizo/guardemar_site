import { createFileRoute } from '@tanstack/react-router'
import { PrivateGuard } from '@/components/portal/auth'
import { AdminServices } from '@/components/portal/addon-management'
export const Route = createFileRoute('/admin/services')({ head: () => ({ meta: [{ title: 'Service requests | GUARDEMAR' }, { name: 'robots', content: 'noindex, nofollow' }] }), component: Page })
function Page() {

  return <PrivateGuard area="admin">{(profile) => <AdminServices profile={profile} />}</PrivateGuard>
}
