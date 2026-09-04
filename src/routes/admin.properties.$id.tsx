import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeft, LockKeyhole } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { PrivateShell } from '@/components/portal/shell'
import { portalApi } from '@/lib/portal/api'
import type { PortalProfile } from '@/lib/portal/types'

type PropertyDetail = Record<string, unknown> & { id: string; display_name: string; client_name: string; address_line_1: string; address_line_2: string | null; postal_code: string; locality: string; municipality: string; country: string; property_type: string; bedrooms: number | null; bathrooms: number | null; has_pool: boolean; has_garden: boolean; has_irrigation: boolean; has_alarm: boolean; access_notes_private: string | null; internal_notes: string | null }

export const Route = createFileRoute('/admin/properties/$id')({ component: PropertyPage })

function PropertyPage() {
  return <PrivateGuard roles={['staff', 'admin']} loginPath="/admin/login">{(profile) => <PropertyDetails profile={profile} />}</PrivateGuard>
}

function PropertyDetails({ profile }: { profile: PortalProfile }) {
  const { id } = Route.useParams()
  const [property, setProperty] = useState<PropertyDetail | null>(null)
  useEffect(() => { void portalApi<{ property: PropertyDetail }>(`admin/properties/${id}`).then((data) => setProperty(data.property)) }, [id])
  if (!property) return <PrivateShell area="admin" profile={profile} title="Property record"><div className="private-panel">Loading property…</div></PrivateShell>
  return <PrivateShell area="admin" profile={profile} title={property.display_name} eyebrow={property.client_name} action={<Link className="private-secondary" to="/admin/properties"><ChevronLeft />Properties</Link>}>
    <div className="record-grid"><section className="private-panel"><div className="panel-heading"><h2>Property details</h2></div><dl className="details-list"><div><dt>Address</dt><dd>{property.address_line_1}{property.address_line_2 ? `, ${property.address_line_2}` : ''}<br />{property.postal_code} {property.locality}<br />{property.municipality}, {property.country}</dd></div><div><dt>Type</dt><dd>{property.property_type}</dd></div><div><dt>Bedrooms</dt><dd>{property.bedrooms ?? 'Not recorded'}</dd></div><div><dt>Bathrooms</dt><dd>{property.bathrooms ?? 'Not recorded'}</dd></div><div><dt>Features</dt><dd>{[property.has_pool && 'Pool', property.has_garden && 'Garden', property.has_irrigation && 'Irrigation', property.has_alarm && 'Alarm'].filter(Boolean).join(', ') || 'None recorded'}</dd></div></dl></section><section className="private-panel staff-only-panel"><div className="panel-heading"><h2><LockKeyhole />Private access information</h2><span>Staff only</span></div><p>{property.access_notes_private || 'No access notes recorded.'}</p><h3>Internal notes</h3><p>{property.internal_notes || 'No internal notes recorded.'}</p></section></div>
    <div className="operations-grid"><section className="private-panel"><div className="panel-heading"><h2>Inspection history</h2></div><p className="panel-empty">No inspections have been recorded yet.</p></section><section className="private-panel"><div className="panel-heading"><h2>Open requests</h2></div><p className="panel-empty">No open property requests.</p></section></div>
  </PrivateShell>
}
