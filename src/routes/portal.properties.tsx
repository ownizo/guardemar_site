import { createFileRoute, Link } from '@tanstack/react-router'
import { MapPin } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { EmptyState, PrivateShell } from '@/components/portal/shell'
import { portalApi } from '@/lib/portal/api'
import type { CustomerInspectionListItem, PortalProfile, PortalProperty } from '@/lib/portal/types'

export const Route = createFileRoute('/portal/properties')({ component: PortalProperties })

function PortalProperties() {
  return <PrivateGuard area="portal">{(profile) => <PropertyList profile={profile} />}</PrivateGuard>
}

function PropertyList({ profile }: { profile: PortalProfile }) {
  const [properties, setProperties] = useState<PortalProperty[]>([])
  const [inspections, setInspections] = useState<CustomerInspectionListItem[]>([])
  useEffect(() => {
    void portalApi<{ properties: PortalProperty[] }>('properties').then((data) => setProperties(data.properties))
    void portalApi<{ inspections: CustomerInspectionListItem[] }>('inspections').then((data) => setInspections(data.inspections))
  }, [])
  return <PrivateShell area="portal" profile={profile} title="Properties" eyebrow="Authorised access">
    {properties.length === 0 ? <EmptyState title="No properties are linked yet">Your authorised properties appear here when Guardemar completes the portal setup.</EmptyState> : <div className="private-list">{properties.map((property) => {
      const baseline = inspections.find((inspection) => inspection.property_id === property.id && inspection.is_baseline)
      return <article key={property.id}><div className="list-icon"><MapPin /></div><div><h2>{property.displayName}</h2><p>{property.addressLine1}{property.addressLine2 ? `, ${property.addressLine2}` : ''}<br />{property.postalCode} {property.locality}, {property.country}</p>{baseline && <p className="baseline-property-line">{baseline.baseline_state === 'acknowledged' && baseline.baseline_acknowledged_at ? `Initial condition: Acknowledged on ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(baseline.baseline_acknowledged_at))}` : <Link to="/portal/inspections/$id" params={{ id: baseline.id }}>Initial condition: Awaiting your review</Link>}</p>}</div><span className="private-pill">{property.propertyType}</span></article>
    })}</div>}
  </PrivateShell>
}
