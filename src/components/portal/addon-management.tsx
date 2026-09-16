export { AddonPayments } from './addon-payment-form'
import { CustomerPaymentRecords } from './addon-payment-form'
import { Link } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { addonServiceCatalogue, optionalServices } from '@/config/optional-services'
import { addonApi } from '@/lib/portal/addon-api'
import { addonStatusLabels, operationalTransitions, type AddonDetail, type AddonRequest, type AddonStatus } from '@/lib/portal/addons'
import type { PortalProfile } from '@/lib/portal/types'
import { PrivateShell } from './shell'
import { ServiceRequests } from './addon-services'

const date = (value: string) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Lisbon' }).format(new Date(value))
export function AdminServiceAlerts() {
  const [requests, setRequests] = useState<AddonRequest[]>([])
  const [error, setError] = useState('')
  const [alerts, setAlerts] = useState<{id:string;label:string;created_at:string;payment?: { addon_request_id:string|null; service_code:string; customer_email?:string; clients?:{first_name:string;last_name:string};properties?:{display_name:string} }}[]>([])
  useEffect(() => { void Promise.all([addonApi<{ requests: AddonRequest[] }>('admin').then((data) => setRequests(data.requests.filter((r) => r.status === 'requested'))), addonApi<{alerts: typeof alerts}>('admin/alerts').then((data) => setAlerts(data.alerts))]).catch((error: Error) => setError(error.message)) }, [])
  return <section className="private-panel addon-alerts"><h2>New service requests <span className="private-pill">{requests.length}</span></h2>{error ? <p className="form-error" role="alert">{error}</p> : requests.length ? <><p>New Optional Service Request</p><ServiceRequests requests={requests} admin /></> : <p>No new Optional Service requests.</p>}<Link to="/admin/services">View Services</Link>{alerts.length > 0 && <><h2>Payment alerts</h2><div className="private-list">{alerts.map((alert) => <article key={alert.id}><div><h3>{alert.label}</h3><p>{addonServiceCatalogue.find((s) => s.id === alert.payment?.service_code)?.name} · {alert.payment?.clients ? `${alert.payment.clients.first_name} ${alert.payment.clients.last_name}` : alert.payment?.customer_email} · {alert.payment?.properties?.display_name}</p><small>{date(alert.created_at)}</small>{alert.payment?.addon_request_id ? <Link to="/admin/services/$id" params={{id:alert.payment.addon_request_id}}>Open request</Link> : <Link to="/admin/add-on-payments">Open Add-on Payments</Link>}</div></article>)}</div></>}</section>
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
      {detail.payments.length > 0 && <section><h2>{admin ? 'Linked payments' : 'Payment status'}</h2><CustomerPaymentRecords payments={detail.payments} /></section>}
      {admin && <><section className="private-panel"><h2>Review request</h2><p>Operational email: {detail.emailDelivery?.sent_at ? `Sent on ${date(detail.emailDelivery.sent_at)}` : detail.emailDelivery?.first_attempt_at && Date.now() - new Date(detail.emailDelivery.first_attempt_at).getTime() > 23 * 3600000 ? 'Delivery needs manual reconciliation. Check Resend before sending another notification.' : 'Pending delivery; automatic retries are enabled.'}</p><form className="admin-form" onSubmit={review}><label>Status<select value={status} disabled={pending} onChange={(e) => setStatus(e.target.value as AddonStatus)}><option value={detail.request.status}>{addonStatusLabels[detail.request.status]}</option>{operationalTransitions[detail.request.status].map((next) => <option value={next} key={next}>{next === 'in_progress' ? 'In progress' : addonStatusLabels[next]}</option>)}</select></label><label className="full-field">Internal note <span>Never visible to the customer</span><textarea name="internalNote" rows={5} maxLength={5000} disabled={pending} /></label><div className="form-actions full-field"><button className="private-primary" disabled={pending}>{pending ? 'Saving…' : 'Save review'}</button>{profile.role === 'admin' && <Link className="private-secondary" to="/admin/add-on-payments" search={{ requestId: id }}>Prepare payment draft</Link>}</div></form></section><section className="private-panel"><h2>Internal notes</h2>{detail.internalNotes?.map((note) => <div key={note.id}><p className="addon-observations">{note.note}</p><small>{date(note.created_at)}</small></div>)}<h2>History</h2>{detail.history?.map((event) => <p key={event.id}>{event.event_type.replaceAll('_', ' ')} · {date(event.created_at)}</p>)}</section></>}
    </>}
  </PrivateShell>
}
