import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { MapPin } from 'lucide-react'
import { optionalServices, type OptionalService } from '@/config/optional-services'
import { ServiceIcon } from '@/components/optional-services'
import { PrivateShell, EmptyState } from './shell'
import { addonApi } from '@/lib/portal/addon-api'
import { portalApi } from '@/lib/portal/api'
import { addonStatusLabels, priceDisclaimer, requestConfirmation, type AddonRequest, type ShoppingItem } from '@/lib/portal/addons'
import type { PortalProfile, PortalProperty } from '@/lib/portal/types'

export function ServiceRequests({ requests, admin = false }: { requests: AddonRequest[]; admin?: boolean }) {
  return <div className="private-list">{requests.map((request) => <article key={request.id}><div className="list-icon"><ServiceIcon name={optionalServices.find((service) => service.id === request.service_code)?.icon ?? 'mail'} /></div><div><h2><Link to={admin ? '/admin/services/$id' : '/portal/services/requests/$id'} params={{ id: request.id }}>{optionalServices.find((service) => service.id === request.service_code)?.name ?? request.service_code}</Link></h2><p>{request.request_reference}<br />{request.properties?.display_name} · {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(request.created_at))}</p>{admin && <p>{request.clients?.first_name} {request.clients?.last_name}</p>}</div><span className="private-pill">{addonStatusLabels[request.status]}</span></article>)}</div>
}
export function CustomerServices({ profile }: { profile: PortalProfile }) {
  const [requests, setRequests] = useState<AddonRequest[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => { void addonApi<{ requests: AddonRequest[] }>().then((data) => setRequests(data.requests)).catch((error: Error) => setError(error.message)).finally(() => setLoading(false)) }, [])
  return <PrivateShell area="portal" profile={profile} title="Services" eyebrow="Extra care, arranged personally">
    <p className="addon-intro">Tell us what your home needs. A Guardemar agent will review each request and confirm the details and final amount before payment.</p>
    <div className="addon-service-grid">{optionalServices.map((service) => <article className="private-panel addon-service-card" key={service.id}><span className="optional-card-icon"><ServiceIcon name={service.icon} /></span><h2>{service.name}</h2><p>{service.description.split('. ')[0]}.</p><p className="addon-price"><strong>{service.fee}</strong>{'extraCost' in service && <span>{service.extraCost}</span>}</p><Link className="private-secondary" to="/portal/services/$serviceCode" params={{ serviceCode: service.id }}>View service</Link></article>)}</div>
    <section className="addon-history"><h2>Your requests</h2>{error && <p className="form-error" role="alert">{error}</p>}{loading ? <p role="status">Loading your requests…</p> : !error && requests.length === 0 ? <EmptyState title="No service requests yet">Your requests and their progress will appear here.</EmptyState> : <ServiceRequests requests={requests} />}</section>
  </PrivateShell>
}
const emptyItem = (): ShoppingItem => ({ product: '', quantity: '', preferredBrand: '', alternativePolicy: 'any_suitable', alternativeProduct: '', notes: '' })
export function CustomerServiceForm({ profile, serviceCode }: { profile: PortalProfile; serviceCode: string }) {
  const service = optionalServices.find((item) => item.id === serviceCode) as OptionalService | undefined
  const [properties, setProperties] = useState<PortalProperty[]>([])
  const [propertyId, setPropertyId] = useState('')
  const [items, setItems] = useState<ShoppingItem[]>([emptyItem()])
  const [pending, setPending] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [request, setRequest] = useState<AddonRequest | null>(null)
  const key = useRef('')
  const sending = useRef(false)
  useEffect(() => {
    key.current = crypto.randomUUID()
    void portalApi<{ properties: PortalProperty[] }>('properties').then((data) => { setProperties(data.properties); if (data.properties.length === 1) setPropertyId(data.properties[0].id); setLoaded(true) }).catch((error: Error) => setError(error.message))
  }, [])
  function changeItem(index: number, field: keyof ShoppingItem, value: string) {
    setItems((current) => current.map((item, i) => i === index ? { ...item, [field]: value, ...(field === 'alternativePolicy' && value !== 'specific' ? { alternativeProduct: '' } : {}) } : item))
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending.current || !service) return
    sending.current = true; setPending(true); setError('')
    const form = new FormData(event.currentTarget)
    const value = (name: string) => String(form.get(name) ?? '')
    const serviceDetails = service.id === 'pre-arrival-shopping' ? { arrivalDate: value('arrivalDate'), arrivalTime: value('arrivalTime'), specialInstructions: value('specialInstructions'), items } : service.id === 'airport-transfer-coordination' ? { direction: value('direction'), airport: value('airport'), date: value('date'), time: value('time'), flightNumber: value('flightNumber'), passengers: Number(value('passengers')), luggage: value('luggage'), childSeats: value('childSeats') } : {}
    const payload = JSON.stringify({ propertyId, serviceCode: service.id, customerNotes: value('customerNotes'), serviceDetails })
    try {
      const data = await addonApi<{ request: AddonRequest }>('', { method: 'POST', body: JSON.stringify({ ...JSON.parse(payload), idempotencyKey: key.current }) })
      setRequest(data.request)
    } catch (error) { setError(error instanceof Error ? error.message : 'The request could not be sent.') }
    finally { sending.current = false; setPending(false) }
  }
  if (!service) return <PrivateShell area="portal" profile={profile} title="Service unavailable"><Link to="/portal/services">Return to Services</Link></PrivateShell>
  if (request) return <PrivateShell area="portal" profile={profile} title="Request received"><section className="private-panel addon-confirmation" role="status"><p>{requestConfirmation}</p><dl className="addon-summary"><dt>Request reference</dt><dd>{request.request_reference}</dd><dt>Service</dt><dd>{service.name}</dd><dt>Property</dt><dd>{request.properties.display_name}</dd><dt>Status</dt><dd>Requested</dd></dl><Link className="private-primary" to="/portal/services/requests/$id" params={{ id: request.id }}>View request</Link></section></PrivateShell>
  return <PrivateShell area="portal" profile={profile} title={service.name} eyebrow="Optional Service"><Link to="/portal/services" className="addon-back">← Services</Link>
    <section className="private-panel addon-description"><ServiceIcon name={service.icon} /><p>{service.description}</p><p className="addon-price"><span>GUARDEMAR service price</span><strong>{service.fee}</strong>{service.extraCost && <span>{service.id === 'pre-arrival-shopping' ? 'Shopping expenses: Additional' : service.extraCost}</span>}</p><p>{priceDisclaimer}</p><p>Tell us what you need. A Guardemar agent will review your request and contact you to confirm the details and final amount before payment.</p>{service.id === 'pre-arrival-shopping' && <p>The final amount will depend on your shopping list. A Guardemar agent will review your request and contact you before payment.</p>}</section>
    {error && <p className="portal-notice error" role="alert">{error}</p>}
    {!loaded ? <p role="status">Loading authorised properties…</p> : properties.length === 0 ? <EmptyState title="No authorised property">Please contact Guardemar to arrange access before requesting a service.</EmptyState> : <form className="addon-request-form" onSubmit={submit}><fieldset disabled={pending}><legend>Property</legend><div className="private-list addon-properties">{properties.map((property) => <label className="addon-property-card" key={property.id}><input type="radio" name="propertyId" value={property.id} checked={propertyId === property.id} onChange={() => setPropertyId(property.id)} required /><MapPin /><span><strong>{property.displayName}</strong><small>{property.addressLine1}<br />{property.postalCode} {property.locality}</small></span></label>)}</div>
    {service.id === 'pre-arrival-shopping' && <section className="private-panel"><h2>Shopping list</h2><p>Include quantities, preferred brands and acceptable alternatives.</p><div className="addon-shopping-list">{items.map((item, index) => <div className="addon-shopping-card" key={index}><h3>Item {index + 1}</h3><div className="admin-form"><label>Product<input value={item.product} required maxLength={200} placeholder="e.g. Still water 1.5L" onChange={(e) => changeItem(index, 'product', e.target.value)} /></label><label>Quantity<input value={item.quantity} required maxLength={80} placeholder="e.g. 6 bottles" onChange={(e) => changeItem(index, 'quantity', e.target.value)} /></label><label>Preferred brand <span>Optional</span><input value={item.preferredBrand} maxLength={200} placeholder="e.g. Luso" onChange={(e) => changeItem(index, 'preferredBrand', e.target.value)} /></label><label>Alternative<select value={item.alternativePolicy} onChange={(e) => changeItem(index, 'alternativePolicy', e.target.value)}><option value="any_suitable">Any suitable alternative</option><option value="no_substitute">No substitute</option><option value="specific">Specific alternative</option></select></label>{item.alternativePolicy === 'specific' && <label className="full-field">Alternative brand/product<input required value={item.alternativeProduct} maxLength={200} onChange={(e) => changeItem(index, 'alternativeProduct', e.target.value)} /></label>}<label className="full-field">Notes <span>Optional</span><textarea value={item.notes} maxLength={1000} rows={2} onChange={(e) => changeItem(index, 'notes', e.target.value)} /></label></div>{items.length > 1 && <button type="button" className="private-secondary" onClick={() => setItems(items.filter((_, i) => i !== index))}>Remove item {index + 1}</button>}</div>)}</div><button type="button" className="private-secondary" disabled={items.length >= 60} onClick={() => setItems([...items, emptyItem()])}>+ Add another item</button><div className="admin-form addon-arrival"><label>Arrival date<input name="arrivalDate" type="date" required /></label><label>Expected arrival time <span>Portugal time</span><input name="arrivalTime" type="time" required /></label><label className="full-field">Special instructions <span>Optional</span><textarea name="specialInstructions" rows={3} maxLength={2000} placeholder="Please tell us where you would like items placed." /></label></div></section>}
    {service.id === 'airport-transfer-coordination' && <section className="private-panel"><h2>Transfer details</h2><div className="admin-form"><label>Direction<select name="direction"><option value="airport_to_property">Airport → Property</option><option value="property_to_airport">Property → Airport</option></select></label><label>Airport<input name="airport" required maxLength={150} placeholder="e.g. Faro Airport" /></label><label>Date<input name="date" type="date" required /></label><label>Time <span>Portugal time</span><input name="time" type="time" required /></label><label>Flight number <span>Where applicable</span><input name="flightNumber" maxLength={50} /></label><label>Passengers<input name="passengers" type="number" min={1} max={100} required /></label><label>Luggage <span>Optional</span><input name="luggage" maxLength={500} placeholder="Number and size of bags" /></label><label>Child seat requirements <span>Optional</span><input name="childSeats" maxLength={500} /></label></div></section>}
    <section className="private-panel admin-form"><label className="full-field">Additional details <span>Optional</span><textarea name="customerNotes" rows={7} maxLength={5000} placeholder="Please provide any information that may help us arrange this service." /></label><p className="full-field">Sending a request does not confirm a booking or final price. No payment is taken when you send this request.</p><div className="form-actions full-field"><button className="private-primary" disabled={pending || !propertyId}>{pending ? 'Sending request…' : 'SEND REQUEST'}</button></div></section></fieldset></form>}
  </PrivateShell>
}
