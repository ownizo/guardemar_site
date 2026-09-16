import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { addonServiceCatalogue } from '@/config/optional-services'
import { addonPaymentStatusLabels, shoppingPaymentMessage, type AddonPayment, type AddonRequest } from '@/lib/portal/addons'
import { addonApi } from '@/lib/portal/addon-api'
import type { PortalProfile } from '@/lib/portal/types'
import { PrivateShell, EmptyState } from './shell'

type BillingClient = { id: string; first_name: string; last_name: string; email: string }
type Options = { clients: BillingClient[]; livePaymentsEnabled: boolean; externalProviderEnabled: boolean }
export function paymentDisplayStatus(payment: AddonPayment) { return payment.payment_type === 'monthly' && !['expired','cancelled','failed'].includes(payment.payment_status) ? payment.addon_subscriptions?.[0]?.status ?? payment.payment_status : payment.payment_status }
const euro = (minor: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' }).format(minor / 100)
export function AddonPayments({ profile, requestId }: { profile: PortalProfile; requestId?: string }) {
  const [requests, setRequests] = useState<AddonRequest[]>([])
  const [payments, setPayments] = useState<AddonPayment[]>([])
  const [options, setOptions] = useState<Options>({ clients: [], livePaymentsEnabled: false, externalProviderEnabled: false })
  const [serviceCode, setServiceCode] = useState('')
  const [selectedRequest, setSelectedRequest] = useState(requestId ?? '')
  const [clientId, setClientId] = useState('')
  const [email, setEmail] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [monthly, setMonthly] = useState(false)
  const [feeOnly, setFeeOnly] = useState(false)
  const [review, setReview] = useState<AddonPayment | null>(null)
  const [action, setAction] = useState<'send' | 'resend' | 'replace'>('send')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  const sending = useRef(false)
  const draftKey = useRef('')
  const actionKey = useRef('')
  const linked = requests.find((request) => request.id === selectedRequest)
  const external = serviceCode === 'external-provider'
  function refresh() { return addonApi<{ payments: AddonPayment[] }>('admin/payments').then((data) => setPayments(data.payments)) }
  function selectRequest(id: string, list = requests) {
    setSelectedRequest(id)
    const request = list.find((r) => r.id === id)
    if (request) { setServiceCode(request.service_code); setEmail(request.clients?.email ?? ''); setDescription(`${addonServiceCatalogue.find((s) => s.id === request.service_code)?.name} — ${request.properties.display_name} — ${request.request_reference}`) }
  }
  useEffect(() => {
    draftKey.current = crypto.randomUUID(); actionKey.current = crypto.randomUUID()
    void Promise.all([addonApi<{ requests: AddonRequest[] }>('admin').then((data) => { setRequests(data.requests); if (requestId) selectRequest(requestId, data.requests) }), addonApi<Options>('admin/billing-options').then(setOptions), refresh()]).catch((error: Error) => setError(error.message))
  }, [requestId])
  async function prepare(event: FormEvent) {
    event.preventDefault(); if (sending.current) return
    sending.current = true; setPending(true); setError(''); setNotice('')
    try {
      const input = { ...(external ? { ...(clientId ? { clientId } : {}) } : { requestId: selectedRequest }), serviceCode, idempotencyKey: draftKey.current, email, amountEur: amount, description, currency: 'EUR', monthly, serviceFeeOnlyConfirmed: feeOnly }
      const data = await addonApi<{ payment: AddonPayment }>('admin/payments', { method: 'POST', body: JSON.stringify(input) })
      setReview(data.payment); setAction('send'); actionKey.current = crypto.randomUUID(); await refresh()
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not prepare payment.') }
    finally { sending.current = false; setPending(false) }
  }
  async function confirm() {
    if (!review || sending.current) return
    sending.current = true; setPending(true); setError('')
    try {
      const data = await addonApi<{ emailDeliveryPending: boolean }>(`admin/payments/${review.id}/${action}`, { method: 'POST', body: JSON.stringify({ confirmed: true, actionKey: actionKey.current }) })
      setNotice(data.emailDeliveryPending ? 'Secure link created. Email delivery is pending and will be retried.' : review.payment_type === 'monthly' ? 'Monthly subscription setup link sent. Activation awaits the customer’s Checkout and verified payment.' : 'Payment link sent. Payment awaits Stripe confirmation.')
      setReview(null); draftKey.current = crypto.randomUUID(); setServiceCode(''); setSelectedRequest(''); setClientId(''); setEmail(''); setDescription(''); setAmount(''); setMonthly(false); setFeeOnly(false); await refresh()
    } catch (error) { setError(error instanceof Error ? error.message : 'The link could not be sent.') }
    finally { sending.current = false; setPending(false) }
  }
  async function editDraft() {
    if (!review || sending.current) return
    sending.current = true; setPending(true); setError('')
    try { await addonApi(`admin/payments/${review.id}/cancel-draft`, { method: 'POST', body: JSON.stringify({ confirmed: true, actionKey: crypto.randomUUID() }) }); setReview(null); draftKey.current = crypto.randomUUID(); await refresh() }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not edit draft.') }
    finally { sending.current = false; setPending(false) }
  }
  function reviewExisting(payment: AddonPayment, next: typeof action) { setReview(payment); setAction(next); actionKey.current = crypto.randomUUID(); setNotice(''); setError('') }
  return <PrivateShell area="admin" profile={profile} title="Add-on Payments" eyebrow="Final amounts, personally confirmed">
    {!options.livePaymentsEnabled && <p className="portal-notice" role="status">Payment creation is implemented. Controlled LIVE tests await approval; sending Stripe links is currently disabled.</p>}
    {error && <p className="portal-notice error" role="alert">{error}</p>}{notice && <p className="portal-notice success" role="status">{notice}</p>}
    {profile.role === 'admin' && !review && <section className="private-panel"><h2>New payment</h2><form className="admin-form" onSubmit={prepare}>
      <label>Service<select value={serviceCode} required disabled={pending} onChange={(e) => { setServiceCode(e.target.value); setSelectedRequest(''); setClientId(''); setEmail(''); setDescription(''); setFeeOnly(false) }}><option value="">Select a service</option>{addonServiceCatalogue.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      {external ? <label>Customer <span>Optional for email-only payments</span><select value={clientId} disabled={pending} onChange={(e) => { setClientId(e.target.value); setEmail(options.clients.find((c) => c.id === e.target.value)?.email ?? '') }}><option value="">Email-only customer</option>{options.clients.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</select></label> : <label>Linked Optional Service Request<select required value={selectedRequest} disabled={pending} onChange={(e) => selectRequest(e.target.value)}><option value="">Select a reviewed request</option>{requests.filter((r) => r.service_code === serviceCode && ['under_review','awaiting_customer'].includes(r.status)).map((r) => <option key={r.id} value={r.id}>{r.request_reference} · {r.clients?.first_name} {r.clients?.last_name} · {r.properties.display_name}</option>)}</select></label>}
      {!external && linked && <label>Customer<input readOnly value={`${linked.clients?.first_name ?? ''} ${linked.clients?.last_name ?? ''}`} /></label>}
      <label>Email<input type="email" required maxLength={254} value={email} disabled={pending} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>{external ? monthly ? 'Final monthly amount to charge (EUR)' : 'Final amount to charge (EUR)' : monthly ? 'Final monthly amount (VAT included) — EUR' : 'FINAL AMOUNT (VAT INCLUDED) — EUR'}<input inputMode="decimal" required pattern="(?:0|[1-9][0-9]{0,5})(?:\.[0-9]{1,2})?" value={amount} disabled={pending} onChange={(e) => setAmount(e.target.value)} /></label>
      <label className="full-field">Description<textarea required rows={4} maxLength={1000} value={description} disabled={pending} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the agreed service and scope." /></label>
      <label className="check-field full-field"><input type="checkbox" checked={monthly} disabled={pending} onChange={(e) => setMonthly(e.target.checked)} />Monthly recurring payment</label>
      <p className="full-field">Billing: {monthly ? 'Monthly recurring. The customer sets up recurring payment through Stripe Checkout.' : 'One-time payment.'} The amount entered is the exact final charge. No VAT is added on top.</p>
      {external && <p className="full-field">External Provider is a separate payment category. No 23% VAT calculation is assumed. LIVE activation requires its accounting configuration to be approved.</p>}
      {serviceCode === 'pre-arrival-shopping' && <><p className="full-field">{shoppingPaymentMessage}</p><label className="check-field full-field"><input type="checkbox" required checked={feeOnly} disabled={pending} onChange={(e) => setFeeOnly(e.target.checked)} />I confirm this Stripe amount contains the Guardemar service fee only. It excludes groceries, shopping expenditure and customer purchase funds.</label></>}
      <div className="form-actions full-field"><button className="private-primary" disabled={pending}>{pending ? 'Preparing…' : 'Review payment'}</button></div>
    </form></section>}
    {review && <section className="private-panel addon-payment-review" aria-label="Confirm payment request"><h2>Confirm {review.payment_type === 'monthly' ? 'monthly subscription' : 'one-time payment'}</h2><dl className="addon-summary"><dt>Service</dt><dd>{addonServiceCatalogue.find((s) => s.id === review.service_code)?.name}</dd><dt>Customer</dt><dd>{review.clients ? `${review.clients.first_name} ${review.clients.last_name}` : 'Email-only customer'}</dd><dt>Email</dt><dd>{review.customer_email}</dd><dt>Description</dt><dd>{review.description}</dd><dt>Payment type</dt><dd>{review.payment_type === 'monthly' ? 'Monthly recurring' : 'One-time'}</dd><dt>{review.payment_type === 'monthly' ? 'Monthly amount' : 'Final amount'}</dt><dd><strong>{euro(review.amount)}</strong><small>{review.amount_semantics === 'vat_included' ? 'VAT included (23%) — nothing added on top' : review.amount_semantics === 'unapproved' ? 'Legacy draft — amount treatment must be reviewed in a new draft' : 'Final charge — external provider tax treatment recorded separately'}</small></dd>{review.amount_net !== null && review.amount_tax !== null && <><dt>Net</dt><dd>{euro(review.amount_net)}</dd><dt>VAT 23%</dt><dd>{euro(review.amount_tax)}</dd></>}</dl><p>Payments are non-refundable once paid. Operational completion remains separate from payment.</p>{review.service_code === 'pre-arrival-shopping' && <p>{shoppingPaymentMessage}</p>}<div className="form-actions"><button className="private-primary" disabled={pending || !options.livePaymentsEnabled || (review.payment_category === 'external_provider' && !options.externalProviderEnabled) || review.amount_semantics === 'unapproved'} onClick={confirm}>{pending ? 'Sending…' : action === 'resend' ? 'Resend existing link' : action === 'replace' ? 'Create replacement link' : review.payment_type === 'monthly' ? 'SEND SUBSCRIPTION LINK' : 'SEND PAYMENT LINK'}</button>{review.payment_status === 'draft' ? <button className="private-secondary" disabled={pending} onClick={editDraft}>Edit details — cancel unused draft</button> : <button className="private-secondary" disabled={pending} onClick={() => setReview(null)}>Back</button>}</div></section>}
    <section className="addon-history"><h2>Payment records</h2><div className="addon-payment-filters"><label className="addon-filter">Type<select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="all">All types</option><option value="one_time">One-time</option><option value="monthly">Monthly</option></select></label><label className="addon-filter">Status<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All statuses</option>{Object.entries(addonPaymentStatusLabels).map(([key,label]) => <option value={key} key={key}>{label}</option>)}</select></label><label className="addon-filter">Category<select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="all">All categories</option><option value="guardemar_service">Guardemar service</option><option value="external_provider">External Provider</option></select></label></div>
      {!payments.length ? <EmptyState title="No add-on payments yet">Reviewed payment requests will appear here.</EmptyState> : <div className="private-list">{payments.filter((p) => (typeFilter === 'all' || p.payment_type === typeFilter) && (statusFilter === 'all' || paymentDisplayStatus(p) === statusFilter) && (categoryFilter === 'all' || p.payment_category === categoryFilter)).map((payment) => <article key={payment.id}><div><h2>{addonServiceCatalogue.find((s) => s.id === payment.service_code)?.name}</h2><p>{new Intl.DateTimeFormat('en-GB',{dateStyle:'medium'}).format(new Date(payment.created_at))} · {payment.clients ? `${payment.clients.first_name} ${payment.clients.last_name}` : payment.customer_email}</p><p>{payment.description}</p><p>{payment.payment_type === 'monthly' ? 'Monthly' : 'One-time'} · {euro(payment.amount)}{payment.amount_semantics === 'vat_included' ? ' VAT included' : ' final charge'}</p>{payment.addon_request_id && <Link to="/admin/services/$id" params={{ id: payment.addon_request_id }}>View request</Link>}{profile.role === 'admin' && <div className="form-actions">{payment.payment_status === 'draft' ? <button className="private-secondary" onClick={() => reviewExisting(payment,'send')}>Review draft</button> : ['sent','payment_link_created','expired'].includes(payment.payment_status) && !['active','past_due','cancelled','ended'].includes(paymentDisplayStatus(payment)) && <><button className="private-secondary" onClick={() => reviewExisting(payment,'resend')}>Review resend</button><button className="private-secondary" onClick={() => reviewExisting(payment,'replace')}>Review expired-link replacement</button></>}</div>}</div><span className="private-pill">{addonPaymentStatusLabels[paymentDisplayStatus(payment)] ?? paymentDisplayStatus(payment)}</span></article>)}</div>}
    </section>
  </PrivateShell>
}
export function CustomerPaymentRecords({ payments }: { payments: AddonPayment[] }) {
  const [error, setError] = useState('')
  const [pending, setPending] = useState('')
  async function open(payment: AddonPayment) {
    setPending(payment.id); setError('')
    try { const data = await addonApi<{ url: string }>(`payments/${payment.id}/link`); if (data.url.startsWith('https://checkout.stripe.com/')) window.location.assign(data.url) }
    catch (error) { setError(error instanceof Error ? error.message : 'This payment link is unavailable.') }
    finally { setPending('') }
  }
  return <>{error && <p className="form-error" role="alert">{error}</p>}{payments.map((payment) => <section className="private-panel" key={payment.id}><h2>{addonServiceCatalogue.find((s) => s.id === payment.service_code)?.name}</h2><p>{payment.description}</p><p><span className="private-pill">{paymentDisplayStatus(payment) === 'sent' ? 'Payment requested' : addonPaymentStatusLabels[paymentDisplayStatus(payment)] ?? paymentDisplayStatus(payment)}</span></p><p>{payment.payment_type === 'monthly' ? 'Monthly amount' : 'Final amount'}: <strong>{euro(payment.amount)}</strong>{payment.amount_semantics === 'vat_included' ? ' VAT included' : ''}</p>{payment.paid_at && <p>Payment date: {new Intl.DateTimeFormat('en-GB',{dateStyle:'medium'}).format(new Date(payment.paid_at))}</p>}{payment.service_code === 'pre-arrival-shopping' && <p>{shoppingPaymentMessage}</p>}{['sent','payment_link_created'].includes(payment.payment_status) && !['active','past_due','cancelled','ended'].includes(paymentDisplayStatus(payment)) && <button className="private-primary" disabled={!!pending} onClick={() => open(payment)}>{pending === payment.id ? 'Opening…' : payment.payment_type === 'monthly' ? 'Set up monthly payment' : 'Proceed to secure payment'}</button>}<p>Payments are non-refundable once paid. Payment and service completion are separate.</p></section>)}</>
}
