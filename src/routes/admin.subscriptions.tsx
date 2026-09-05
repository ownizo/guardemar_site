import { createFileRoute, Link } from '@tanstack/react-router'
import { CreditCard } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { EmptyState, PrivateShell } from '@/components/portal/shell'
import { formatEuro, subscriptionPlans } from '@/config/subscriptions'
import { subscriptionApi, type SubscriptionSummary } from '@/lib/portal/subscriptions'
import type { PortalProfile } from '@/lib/portal/types'

export const Route = createFileRoute('/admin/subscriptions')({ component: Page })
function Page() { return <PrivateGuard area="admin">{(profile) => <List profile={profile} />}</PrivateGuard> }

function List({ profile }: { profile: PortalProfile }) {
  const search = Route.useSearch() as { clientId?: string; propertyId?: string }
  const [items, setItems] = useState<SubscriptionSummary[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const query = new URLSearchParams()
    if (search.clientId) query.set('clientId', search.clientId)
    if (search.propertyId) query.set('propertyId', search.propertyId)
    subscriptionApi<{ subscriptions: SubscriptionSummary[] }>(query.size ? `?${query}` : '').then((data) => setItems(data.subscriptions)).finally(() => setLoading(false))
  }, [search.clientId, search.propertyId])
  return <PrivateShell area="admin" profile={profile} title="Subscriptions" eyebrow="Contracts and Stripe billing">
    {loading ? <div className="private-panel">Loading subscriptions…</div> : items.length === 0 ? <EmptyState title="No subscriptions recorded">Accepted Guardemar Service Orders and Stripe billing records appear here.</EmptyState> : <div className="private-list subscription-list">{items.map((item) => <Link to="/admin/subscriptions/$id" params={{ id: item.id }} key={item.id}><div className="list-icon"><CreditCard /></div><div><h2>{item.properties?.display_name || 'Property'}</h2><p>{item.clients ? `${item.clients.first_name} ${item.clients.last_name} · ` : ''}{subscriptionPlans[item.plan_code].name} · {item.billing_interval === 'month' ? 'Monthly' : 'Annual'}<br /><span>{formatEuro(item.gross_amount)} including {item.tax_display_name} · {item.payment_status.replaceAll('_', ' ')}</span></p></div><span className="private-pill">{item.local_status.replaceAll('_', ' ')}</span></Link>)}</div>}
  </PrivateShell>
}
