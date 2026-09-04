import { createFileRoute } from '@tanstack/react-router'
import { MapPin } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { EmptyState, PrivateShell } from '@/components/portal/shell'
import { portalApi } from '@/lib/portal/api'
import type { PortalProfile, PortalProperty } from '@/lib/portal/types'

export const Route = createFileRoute('/portal/properties')({ component: PortalProperties })

function PortalProperties() {
  return <PrivateGuard roles={['customer', 'staff', 'admin']} loginPath="/portal/login">{(profile) => <PropertyList profile={profile} />}</PrivateGuard>
}

function PropertyList({ profile }: { profile: PortalProfile }) {
  const [properties, setProperties] = useState<PortalProperty[]>([])
  useEffect(() => { void portalApi<{ properties: PortalProperty[] }>('properties').then((data) => setProperties(data.properties)) }, [])
  return <PrivateShell area="portal" profile={profile} title="Properties" eyebrow="Authorised access">
    {properties.length === 0 ? <EmptyState title="No properties are linked yet">Your authorised properties appear here when Guardemar completes the portal setup.</EmptyState> : <div className="private-list">{properties.map((property) => <article key={property.id}><div className="list-icon"><MapPin /></div><div><h2>{property.displayName}</h2><p>{property.addressLine1}{property.addressLine2 ? `, ${property.addressLine2}` : ''}<br />{property.postalCode} {property.locality}, {property.country}</p></div><span className="private-pill">{property.propertyType}</span></article>)}</div>}
  </PrivateShell>
}
