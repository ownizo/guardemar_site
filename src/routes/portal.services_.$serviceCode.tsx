import { createFileRoute } from '@tanstack/react-router'
import { PrivateGuard } from '@/components/portal/auth'
import { CustomerServiceForm } from '@/components/portal/addon-services'
export const Route = createFileRoute('/portal/services_/$serviceCode')({ head: () => ({ meta: [{ title: 'Request a service | GUARDEMAR' }, { name: 'robots', content: 'noindex, nofollow' }] }), component: Page })
function Page() {
  const { serviceCode } = Route.useParams()
  return <PrivateGuard area="portal">{(profile) => <CustomerServiceForm profile={profile} serviceCode={serviceCode} />}</PrivateGuard>
}
