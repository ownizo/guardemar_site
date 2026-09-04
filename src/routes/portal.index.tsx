import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, ClipboardCheck, Home, ShieldCheck } from 'lucide-react'
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
  return <PrivateGuard area="portal">{(profile) => <Overview profile={profile} />}</PrivateGuard>
}

function Overview({ profile }: { profile: PortalProfile }) {
  const [properties, setProperties] = useState<PortalProperty[]>([])
  const [inspections, setInspections] = useState<{ id: string; scheduled_for: string; property_name: string; overall_condition: 'good' | 'attention' | 'urgent' }[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { Promise.all([portalApi<{ properties: PortalProperty[] }>('properties').then((data) => setProperties(data.properties)), portalApi<{ inspections: typeof inspections }>('inspections').then((data) => setInspections(data.inspections.slice(0, 3)))]).finally(() => setLoading(false)) }, [])
  const firstName = profile.firstName || 'there'

  return <PrivateShell area="portal" profile={profile} title={`Good morning, ${firstName}`} eyebrow="Here when you’re away.">
    {loading ? <div className="private-panel">Loading your properties…</div> : properties.length === 0 ? <EmptyState title="No properties are linked yet">Guardemar is preparing your private property access. Please contact us if you expected to see a property here.</EmptyState> : <><div className="portal-property-grid">{properties.map((property) => <article className="property-overview-card" key={property.id}><div className="property-card-icon"><Home /></div><p className="private-eyebrow">Your property</p><h2>{property.displayName}</h2><p>{property.locality} · {property.municipality}</p><div className="property-status"><ShieldCheck /><span><small>Property status</small>Ready for inspections</span></div><p className="muted-copy">Published inspection reports appear only after Guardemar’s internal review.</p><Link to="/portal/properties" className="private-secondary">View property <ArrowRight /></Link></article>)}</div>{inspections.length > 0 && <section className="private-panel recent-reports"><div className="panel-heading"><h2>Recent inspection reports</h2><Link to="/portal/inspections">View all</Link></div>{inspections.map((inspection) => <Link to="/portal/inspections/$id" params={{ id: inspection.id }} key={inspection.id}><ClipboardCheck /><span><strong>{inspection.property_name}</strong><small>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date(inspection.scheduled_for))}</small></span><b>{inspection.overall_condition.toUpperCase()}</b></Link>)}</section>}</>}
  </PrivateShell>
}
