import { createFileRoute } from '@tanstack/react-router'
import { PrivateGuard } from '@/components/portal/auth'
import { AddonPayments } from '@/components/portal/addon-management'
export const Route = createFileRoute('/admin/add-on-payments')({ validateSearch: (search: Record<string, unknown>): { requestId?: string } => ({ requestId: typeof search.requestId === 'string' ? search.requestId : undefined }), head: () => ({ meta: [{ title: 'Add-on Payments | GUARDEMAR' }, { name: 'robots', content: 'noindex, nofollow' }] }), component: Page })
function Page() {
  const { requestId } = Route.useSearch()
  return <PrivateGuard area="admin">{(profile) => <AddonPayments profile={profile} requestId={requestId} />}</PrivateGuard>
}
