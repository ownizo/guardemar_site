import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeft, CreditCard, Download, FileText } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { PrivateShell } from '@/components/portal/shell'
import { formatEuro, subscriptionPlans, type SubscriptionPlanCode } from '@/config/subscriptions'
import { downloadSubscriptionTerms, subscriptionApi } from '@/lib/portal/subscriptions'
import type { PortalProfile } from '@/lib/portal/types'

export const Route = createFileRoute('/portal/subscriptions_/$id')({ component: Page })

function Page() { return <PrivateGuard area="portal">{(profile) => <Detail profile={profile} />}</PrivateGuard> }

function Detail({ profile }: { profile: PortalProfile }) {
  const { id } = Route.useParams()
  const search = typeof window === 'undefined' ? '' : window.location.search
  const [data, setData] = useState<any>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(async () => { const result = await subscriptionApi<any>(id); setData(result); return result }, [id])
  useEffect(() => {
    void load()
    if (!search.includes('checkout=return')) return
    const timer = window.setInterval(() => { void load().then((result) => { if (['active', 'ended', 'cancelled'].includes(result.subscription.local_status)) window.clearInterval(timer) }) }, 3000)
    return () => window.clearInterval(timer)
  }, [load, search])
  async function billingPortal() { setPending(true); setError(''); try { const result = await subscriptionApi<{ url: string }>('billing-portal', { method: 'POST', body: JSON.stringify({ subscriptionId: id }) }); window.location.assign(result.url) } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'The billing portal could not be opened.') } finally { setPending(false) } }
  async function continueCheckout() { setPending(true); setError(''); try { const result = await subscriptionApi<{ url: string }>('checkout', { method: 'POST', body: JSON.stringify({ subscriptionId: id }) }); window.location.assign(result.url) } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Secure Checkout could not be opened.'); await load() } finally { setPending(false) } }
  async function downloadTerms() { setError(''); try { await downloadSubscriptionTerms(acceptance.terms_version) } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'The General Terms could not be downloaded.') } }
  if (!data) return <PrivateShell area="portal" profile={profile} title="Service subscription"><div className="private-panel">Loading subscription…</div></PrivateShell>
  const item = data.subscription
  const plan = subscriptionPlans[item.plan_code as SubscriptionPlanCode]
  const acceptance = Array.isArray(item.service_agreement_acceptances) ? item.service_agreement_acceptances[0] : item.service_agreement_acceptances
  const order = acceptance?.service_order_snapshot
  return <PrivateShell area="portal" profile={profile} title={item.properties?.display_name || 'Service subscription'} eyebrow={plan.name} action={<Link className="private-secondary" to="/portal/subscriptions"><ChevronLeft />Subscriptions</Link>}>
    {error && <div className="portal-notice error" role="alert">{error}</div>}
    {search.includes('checkout=return') && item.local_status !== 'active' && <div className="subscription-confirming" role="status"><CreditCard /><div><strong>Payment received. We are confirming your Guardemar service subscription.</strong><p>The verified Stripe webhook, not this page, controls activation. This page refreshes automatically.</p></div></div>}
    {search.includes('checkout=cancelled') && <div className="portal-notice warning" role="status">Secure Checkout was not completed. Your accepted Service Order remains available and no subscription is activated by this return page.</div>}
    <div className="record-grid"><section className="private-panel"><div className="panel-heading"><h2>Agreement</h2><span className="private-pill">{item.local_status.replaceAll('_', ' ')}</span></div><dl className="details-list"><div><dt>Plan</dt><dd>{plan.name}</dd></div><div><dt>Billing</dt><dd>{item.billing_interval === 'month' ? 'Monthly in advance' : 'Annually in advance'}</dd></div><div><dt>Contract</dt><dd>12 months · {item.contract_start_date || 'Pending'} to {item.contract_end_date || 'Pending'}</dd></div><div><dt>Plan Fee</dt><dd>{formatEuro(item.selected_net_amount)} net</dd></div><div><dt>{item.tax_display_name}</dt><dd>{item.tax_percentage}% · {formatEuro(item.tax_amount)}</dd></div><div><dt>Current total</dt><dd>{formatEuro(item.gross_amount)}</dd></div><div><dt>Payment status</dt><dd>{item.payment_status.replaceAll('_', ' ')}</dd></div><div><dt>Next payment / renewal</dt><dd>{item.stripe_current_period_end ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date(item.stripe_current_period_end)) : item.renews_at || 'Awaiting Stripe confirmation'}</dd></div></dl>{['accepted', 'pending_payment'].includes(item.local_status) && <button className="private-primary" onClick={continueCheckout} disabled={pending}>{pending ? 'Opening…' : 'Continue to secure payment'}</button>}{['active', 'past_due', 'payment_action_required', 'suspended'].includes(item.local_status) && <button className="private-primary" onClick={billingPortal} disabled={pending}>{pending ? 'Opening…' : 'Manage payment method'}</button>}<p className="muted-copy">The billing portal is provided for payment-method management and invoice history. It does not permit subscription cancellation or plan changes.</p></section>
      <section className="private-panel"><div className="panel-heading"><h2><FileText />Accepted documents</h2></div><dl className="details-list"><div><dt>General Terms</dt><dd>Version {acceptance?.terms_version} · effective 5 September 2026</dd></div><div><dt>Terms SHA-256</dt><dd className="hash-value">{acceptance?.terms_sha256}</dd></div><div><dt>Accepted</dt><dd>{acceptance?.accepted_at ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(acceptance.accepted_at)) : 'Pending'}</dd></div></dl>{acceptance && <button type="button" className="private-secondary" onClick={downloadTerms}><Download />Download accepted Terms</button>}{order && <details className="service-order-details"><summary>View immutable Service Order</summary><pre>{JSON.stringify(order, null, 2)}</pre></details>}</section></div>
    <section className="private-panel"><div className="panel-heading"><h2>Payment history</h2></div>{data.payments.length === 0 ? <p className="panel-empty">No webhook-confirmed payments have been recorded.</p> : <div className="payment-history">{data.payments.map((payment: any) => <div key={payment.id}><span>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(payment.occurred_at))}</span><strong>{payment.payment_status.replaceAll('_', ' ')}</strong><span>{payment.amount_gross === null ? 'Amount pending' : formatEuro(payment.amount_gross)}{payment.action_url && <><br /><a href={payment.action_url} target="_blank" rel="noreferrer">Complete payment action</a></>}</span></div>)}</div>}</section>
  </PrivateShell>
}
