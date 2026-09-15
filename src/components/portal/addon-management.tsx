import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { optionalServices } from '@/config/optional-services'
import { addonApi } from '@/lib/portal/addon-api'
import { addonStatusLabels, operationalTransitions, type AddonDetail, type AddonPayment, type AddonRequest, type AddonStatus } from '@/lib/portal/addons'
import type { PortalProfile } from '@/lib/portal/types'
import { PrivateShell, EmptyState } from './shell'
import { ServiceRequests } from './addon-services'

const date = (value: string) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Lisbon' }).format(new Date(value))
export function AdminServiceAlerts() {
  const [requests, setRequests] = useState<AddonRequest[]>([])
  const [error, setError] = useState('')
  useEffect(() => { void addonApi<{ requests: AddonRequest[] }>('admin').then((data) => setRequests(data.requests.filter((r) => r.status === 'requested'))).catch((error: Error) => setError(error.message)) }, [])
  return <section className="private-panel addon-alerts"><h2>New service requests <span className="private-pill">{requests.length}</span></h2>{error ? <p className="form-error" role="alert">{error}</p> : requests.length ? <><p>New Optional Service Request</p><ServiceRequests requests={requests} admin /></> : <p>No new Optional Service requests.</p>}<Link to="/admin/services">View Services</Link></section>
}
export function AdminServices({ profile }: { profile: PortalProfile }) {
  const [requests, setRequests] = useState<AddonRequest[]>([])
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => { void addonApi<{ requests: AddonRequest[] }>('admin').then((data) => setRequests(data.requests)).catch((error: Error) => setError(error.message)).finally(() => setLoading(false)) }, [])
  return <PrivateShell area="admin" profile={profile} title="Services" eyebrow="Optional Service requests"><section className="private-panel addon-alerts"><h2>New service requests: {requests.filter((r) => r.status === 'requested').length}</h2><label className="addon-filter">Filter<select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All requests</option>{Object.entries(addonStatusLabels).filter(([status]) => status !== 'in_progress').map(([status, label]) => <option key={status} value={status}>{status === 'requested' ? 'New' : label}</option>)}</select></label></section>{error && <p className="form-error" role="alert">{error}</p>}{loading ? <p role="status">Loading requests…</p> : <ServiceRequests requests={requests.filter((r) => filter === 'all' || r.status === filter || (filter === 'scheduled' && r.status === 'in_progress'))} admin />}</PrivateShell>
}
const detailLabels: Record<string, string> = { arrivalDate: 'Arrival date', arrivalTime: 'Expected arrival time (Portugal)', specialInstructions: 'Special instructions', direction: 'Direction', airport: 'Airport', date: 'Date', time: 'Time (Portugal)', flightNumber: 'Flight number', passengers: 'Passengers', luggage: 'Luggage', childSeats: 'Child seat requirements' }
export function AddonRequestDetail({ profile, id, admin = false }: { profile: PortalProfile; id: string; admin?: boolean }) {
  const [detail, setDetail] = useState<AddonDetail | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState<AddonStatus>('requested')
  function load() { return addonApi<AddonDetail>(`${admin ? 'admin/' : ''}requests/${id}`).then((data) => { setDetail(data); setStatus(data.request.status) }) }
  useEffect(() => { void load().catch((error: Error) => setError(error.message)) }, [id, admin])
  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!detail || pending) return
    const input = new FormData(event.currentTarget); const form = event.currentTarget
    setPending(true); setError('')
    try { await addonApi(`admin/requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status, expectedStatus: detail.request.status, internalNote: String(input.get('internalNote') ?? '') }) }); await load(); form.reset() }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not save review.') }
    finally { setPending(false) }
  }
  const request = detail?.request
  const service = optionalServices.find((item) => item.id === request?.service_code)
  return <PrivateShell area={admin ? 'admin' : 'portal'} profile={profile} title={service?.name ?? 'Service request'} eyebrow={request?.request_reference}>
    <Link className="addon-back" to={admin ? '/admin/services' : '/portal/services'}>← Services</Link>{error && <p className="portal-notice error" role="alert">{error}</p>}{!detail ? !error && <p role="status">Loading request…</p> : <>
      <section className="private-panel"><dl className="addon-summary"><dt>Status</dt><dd><span className="private-pill">{addonStatusLabels[detail.request.status]}</span></dd><dt>Property</dt><dd>{detail.request.properties.display_name}</dd><dt>Requested</dt><dd>{date(detail.request.created_at)}</dd><dt>Published service price</dt><dd>{detail.request.published_price_snapshot}{detail.request.published_price_note_snapshot && <small>{detail.request.published_price_note_snapshot}</small>}</dd>{admin && <><dt>Customer</dt><dd>{detail.request.clients?.first_name} {detail.request.clients?.last_name}</dd><dt>Email</dt><dd>{detail.request.clients?.email}</dd><dt>Telephone</dt><dd>{detail.request.clients?.phone || 'Not provided'}</dd></>}</dl><h2>Additional details</h2><p className="addon-observations">{detail.request.customer_notes || 'No additional details provided.'}</p>{!admin && <p>A Guardemar agent reviews the details and confirms the final amount before payment. Sending this request does not confirm a booking.</p>}</section>
      {Object.keys(detail.request.service_details).length > 0 && <section className="private-panel"><h2>Service details</h2><dl className="addon-summary">{Object.entries(detail.request.service_details).map(([key, value]) => <div className="addon-detail-pair" key={key}><dt>{detailLabels[key] ?? key}</dt><dd className="addon-observations">{key === 'direction' ? value === 'airport_to_property' ? 'Airport → Property' : 'Property → Airport' : String(value || 'Not provided')}</dd></div>)}</dl></section>}
      {detail.shoppingItems.length > 0 && <section className="private-panel"><h2>Shopping list</h2><div className="addon-shopping-list">{detail.shoppingItems.map((item, index) => <article className="addon-shopping-card" key={item.id}><h3>Item {index + 1}: {item.product}</h3><dl className="addon-summary"><dt>Quantity</dt><dd>{item.quantity}</dd><dt>Preferred brand</dt><dd>{item.preferred_brand || 'No preference'}</dd><dt>Alternative</dt><dd>{item.alternative_policy === 'specific' ? item.alternative_product : item.alternative_policy === 'no_substitute' ? 'No substitute' : 'Any suitable alternative'}</dd>{item.notes && <><dt>Notes</dt><dd className="addon-observations">{item.notes}</dd></>}</dl></article>)}</div></section>}
      {detail.payments.length > 0 && <section className="private-panel"><h2>{admin ? 'Linked payment drafts' : 'Payment status'}</h2>{detail.payments.map((payment) => <div key={payment.id}><p>{payment.description}</p><p>Status: {payment.payment_status === 'draft' ? 'Draft — accounting approval required' : payment.payment_status.replaceAll('_', ' ')}</p>{admin && <p>Proposed amount: {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' }).format(payment.amount / 100)} · amount treatment unapproved</p>}{payment.paid_at && <p>Payment date: {date(payment.paid_at)}</p>}</div>)}</section>}
      {admin && <><section className="private-panel"><h2>Review request</h2><p>Operational email: {detail.emailDelivery?.sent_at ? `Sent on ${date(detail.emailDelivery.sent_at)}` : detail.emailDelivery?.first_attempt_at && Date.now() - new Date(detail.emailDelivery.first_attempt_at).getTime() > 23 * 3600000 ? 'Delivery needs manual reconciliation. Check Resend before sending another notification.' : 'Pending delivery; automatic retries are enabled.'}</p><form className="admin-form" onSubmit={review}><label>Status<select value={status} disabled={pending} onChange={(e) => setStatus(e.target.value as AddonStatus)}><option value={detail.request.status}>{addonStatusLabels[detail.request.status]}</option>{operationalTransitions[detail.request.status].map((next) => <option value={next} key={next}>{next === 'in_progress' ? 'In progress' : addonStatusLabels[next]}</option>)}</select></label><label className="full-field">Internal note <span>Never visible to the customer</span><textarea name="internalNote" rows={5} maxLength={5000} disabled={pending} /></label><div className="form-actions full-field"><button className="private-primary" disabled={pending}>{pending ? 'Saving…' : 'Save review'}</button>{profile.role === 'admin' && <Link className="private-secondary" to="/admin/add-on-payments" search={{ requestId: id }}>Prepare payment draft</Link>}</div></form></section><section className="private-panel"><h2>Internal notes</h2>{detail.internalNotes?.map((note) => <div key={note.id}><p className="addon-observations">{note.note}</p><small>{date(note.created_at)}</small></div>)}<h2>History</h2>{detail.history?.map((event) => <p key={event.id}>{event.event_type.replaceAll('_', ' ')} · {date(event.created_at)}</p>)}</section></>}
    </>}
  </PrivateShell>
}
export function AddonPayments({ profile, requestId }: { profile: PortalProfile; requestId?: string }) {
  const [requests, setRequests] = useState<AddonRequest[]>([])
  const [payments, setPayments] = useState<AddonPayment[]>([])
  const [selected, setSelected] = useState(requestId ?? '')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  const sending = useRef(false)
  const key = useRef('')
  const linked = requests.find((request) => request.id === selected)
  function loadPayments() { return addonApi<{ payments: AddonPayment[] }>('admin/payments').then((data) => setPayments(data.payments)) }
  useEffect(() => { key.current = crypto.randomUUID(); void Promise.all([addonApi<{ requests: AddonRequest[] }>('admin').then((data) => setRequests(data.requests)), loadPayments()]).catch((error: Error) => setError(error.message)) }, [])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!linked || sending.current) return
    sending.current = true; setPending(true); setError(''); setNotice('')
    const form = new FormData(event.currentTarget)
    try { await addonApi('admin/payments', { method: 'POST', body: JSON.stringify({ requestId: linked.id, email: String(form.get('email')), amountEur: String(form.get('amount')), description: String(form.get('description')), currency: 'EUR', idempotencyKey: key.current }) }); setNotice('Payment draft saved. No Stripe payment or customer email was created. Live payments await accounting approval.'); await loadPayments() }
    catch (error) { setError(error instanceof Error ? error.message : 'The draft could not be saved.') }
    finally { sending.current = false; setPending(false) }
  }
  return <PrivateShell area="admin" profile={profile} title="Add-on Payments" eyebrow="Reviewed requests, manually prepared"><section className="private-panel addon-alerts"><h2>Live payment creation is blocked</h2><p>The meaning of the amount, VAT treatment and external-cost collection must be approved before a payment link can be created or sent. Draft amounts are proposals with unapproved tax treatment. Saving a draft does not request payment.</p></section>{error && <p className="portal-notice error" role="alert">{error}</p>}{notice && <p className="portal-notice success" role="status">{notice}</p>}
    {profile.role === 'admin' ? <section className="private-panel"><h2>Prepare a payment draft</h2><label className="addon-filter">Linked Optional Service Request<select value={selected} disabled={pending} onChange={(e) => { setSelected(e.target.value); key.current = crypto.randomUUID(); setNotice('') }}><option value="">Select a reviewed request</option>{requests.filter((r) => ['under_review','awaiting_customer'].includes(r.status)).map((r) => <option key={r.id} value={r.id}>{r.request_reference} · {optionalServices.find((s) => s.id === r.service_code)?.name} · {r.clients?.first_name} {r.clients?.last_name}</option>)}</select></label>{linked && <form className="admin-form" key={selected} onSubmit={save}><label>Customer<input readOnly value={`${linked.clients?.first_name ?? ''} ${linked.clients?.last_name ?? ''}`} /></label><label>Email<input name="email" type="email" required maxLength={254} defaultValue={linked.clients?.email ?? ''} disabled={pending} /></label><label>Proposed amount (EUR) <span>Tax treatment unapproved</span><input name="amount" inputMode="decimal" required pattern="(?:0|[1-9][0-9]{0,5})(?:\.[0-9]{1,2})?" disabled={pending} placeholder="Enter reviewed amount" /></label><label>Currency<input readOnly value="EUR" /></label><label className="full-field">Description<textarea name="description" rows={3} required maxLength={1000} disabled={pending} defaultValue={`${optionalServices.find((s) => s.id === linked.service_code)?.name} — ${linked.properties.display_name} — ${linked.request_reference}`} /></label><div className="form-actions full-field"><button className="private-primary" disabled={pending || payments.some((p) => p.addon_request_id === linked.id && p.payment_status !== 'cancelled')}>{pending ? 'Saving…' : 'Save payment draft'}</button><button type="button" className="private-secondary" disabled>Create and send payment link — awaiting approval</button></div></form>}</section> : <p>Only administrators may prepare payment drafts.</p>}
    <section className="addon-history"><h2>Payment records</h2>{payments.length === 0 ? <EmptyState title="No add-on payments yet">Reviewed payment drafts will appear here.</EmptyState> : <div className="private-list">{payments.map((payment) => <article key={payment.id}><div><h2>{payment.description}</h2><p>Proposed amount: {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' }).format(payment.amount / 100)} · tax treatment unapproved</p><Link to="/admin/services/$id" params={{ id: payment.addon_request_id }}>View linked request</Link></div><span className="private-pill">{payment.payment_status}</span></article>)}</div>}</section>
  </PrivateShell>
}
