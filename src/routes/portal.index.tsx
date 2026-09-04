import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Home, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { EmptyState, PrivateShell } from '@/components/portal/shell'
import { portalApi } from '@/lib/portal/api'
import type { PortalProfile, PortalProperty } from '@/lib/portal/types'

export const Route = createFileRoute('/portal/')({
  head: () => ({ meta: [{ title: 'Client Portal | GUARDEMAR' }, { name: 'robots', content: 'noindex, nofollow' }] }),
  component: PortalOverview,
})

function PortalOverview() {
  return <PrivateGuard roles={['customer', 'staff', 'admin']} loginPath="/portal/login">{(profile) => <Overview profile={profile} />}</PrivateGuard>
}

function Overview({ profile }: { profile: PortalProfile }) {
  const [properties, setProperties] = useState<PortalProperty[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { portalApi<{ properties: PortalProperty[] }>('properties').then((data) => setProperties(data.properties)).finally(() => setLoading(false)) }, [])
  const firstName = profile.firstName || 'there'

  return <PrivateShell area="portal" profile={profile} title={`Good morning, ${firstName}`} eyebrow="Here when you’re away.">
    {loading ? <div className="private-panel">Loading your properties…</div> : properties.length === 0 ? <EmptyState title="No properties are linked yet">Guardemar is preparing your private property access. Please contact us if you expected to see a property here.</EmptyState> : <div className="portal-property-grid">{properties.map((property) => <article className="property-overview-card" key={property.id}><div className="property-card-icon"><Home /></div><p className="private-eyebrow">Your property</p><h2>{property.displayName}</h2><p>{property.locality} · {property.municipality}</p><div className="property-status"><ShieldCheck /><span><small>Property status</small>Ready for inspections</span></div><p className="muted-copy">Published inspection reports appear here once Guardemar has completed and reviewed the first visit.</p><Link to="/portal/properties" className="private-secondary">View property <ArrowRight /></Link></article>)}</div>}
  </PrivateShell>
}
