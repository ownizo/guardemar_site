import { createFileRoute, Link } from '@tanstack/react-router'
import { Building2, ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { EmptyState, PrivateShell } from '@/components/portal/shell'
import { portalApi } from '@/lib/portal/api'
import type { PortalProfile } from '@/lib/portal/types'

type ClientDetail = { id: string; firstName: string; lastName: string; email: string; phone: string; taxNumber: string | null; billingAddress: string | null; country: string; internalNotes: string | null; active: boolean }
type ClientProperty = { id: string; displayName: string; addressLine1: string; locality: string; municipality: string; active: boolean }

export const Route = createFileRoute('/admin/clients/$id')({ component: ClientPage })

function ClientPage() {
  return <PrivateGuard area="admin">{(profile) => <ClientDetails profile={profile} />}</PrivateGuard>
}

function ClientDetails({ profile }: { profile: PortalProfile }) {
  const { id } = Route.useParams()
  const [data, setData] = useState<{ client: ClientDetail; properties: ClientProperty[] } | null>(null)
  useEffect(() => { void portalApi<{ client: ClientDetail; properties: ClientProperty[] }>(`admin/clients/${id}`).then(setData) }, [id])
  if (!data) return <PrivateShell area="admin" profile={profile} title="Client record"><div className="private-panel">Loading client…</div></PrivateShell>
  const { client, properties } = data
  return <PrivateShell area="admin" profile={profile} title={`${client.firstName} ${client.lastName}`} eyebrow="Client record" action={<Link className="private-secondary" to="/admin/clients"><ChevronLeft />Clients</Link>}>
    <div className="record-grid"><section className="private-panel"><div className="panel-heading"><h2>Contact information</h2></div><dl className="details-list"><div><dt>Email</dt><dd>{client.email}</dd></div><div><dt>Telephone</dt><dd>{client.phone}</dd></div><div><dt>Tax number</dt><dd>{client.taxNumber || 'Not provided'}</dd></div><div><dt>Country</dt><dd>{client.country}</dd></div><div><dt>Billing address</dt><dd>{client.billingAddress || 'Not provided'}</dd></div></dl></section><section className="private-panel staff-only-panel"><div className="panel-heading"><h2>Internal notes</h2><span>Staff only</span></div><p>{client.internalNotes || 'No internal notes.'}</p></section></div>
    <section className="private-panel"><div className="panel-heading"><h2>Properties</h2><Link to="/admin/properties">Manage properties</Link></div>{properties.length === 0 ? <EmptyState title="No properties added">Add this client’s first property from the property directory.</EmptyState> : <div className="private-list compact">{properties.map((property) => <Link to="/admin/properties/$id" params={{ id: property.id }} key={property.id}><div className="list-icon"><Building2 /></div><div><h3>{property.displayName}</h3><p>{property.addressLine1}, {property.locality}</p></div><span className="private-pill">{property.active ? 'Active' : 'Inactive'}</span></Link>)}</div>}</section>
  </PrivateShell>
}
