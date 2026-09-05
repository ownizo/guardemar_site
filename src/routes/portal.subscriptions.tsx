import { createFileRoute, Link } from '@tanstack/react-router'
import { CreditCard, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { EmptyState, PrivateShell } from '@/components/portal/shell'
import { formatEuro, subscriptionPlans } from '@/config/subscriptions'
import { subscriptionApi, type SubscriptionSummary } from '@/lib/portal/subscriptions'
import type { PortalProfile } from '@/lib/portal/types'

export const Route = createFileRoute('/portal/subscriptions')({ component: Page })

function Page() { return <PrivateGuard area="portal">{(profile) => <Subscriptions profile={profile} />}</PrivateGuard> }

function Subscriptions({ profile }: { profile: PortalProfile }) {
  const [items, setItems] = useState<SubscriptionSummary[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { subscriptionApi<{ subscriptions: SubscriptionSummary[] }>().then((data) => setItems(data.subscriptions)).finally(() => setLoading(false)) }, [])
  return <PrivateShell area="portal" profile={profile} title="Service subscriptions" eyebrow="12-month Guardemar agreements" action={<Link className="private-primary" to="/portal/subscriptions/new"><Plus />New subscription</Link>}>
    {loading ? <div className="private-panel">Loading subscriptions…</div> : items.length === 0 ? <EmptyState title="No service subscriptions yet">Choose an authorised property and review a Guardemar Service Order before proceeding to secure payment.</EmptyState> : <div className="private-list subscription-list">{items.map((item) => <Link to="/portal/subscriptions/$id" params={{ id: item.id }} key={item.id}><div className="list-icon"><CreditCard /></div><div><h2>{item.properties?.display_name || 'Guardemar property'}</h2><p>{subscriptionPlans[item.plan_code].name} · {item.billing_interval === 'month' ? 'Monthly billing' : 'Annual billing'}<br /><span>{formatEuro(item.gross_amount)} including {item.tax_display_name} · 12-month agreement</span></p></div><span className={`private-pill payment-${item.payment_status}`}>{item.local_status.replaceAll('_', ' ')}</span></Link>)}</div>}
  </PrivateShell>
}

