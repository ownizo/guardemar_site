import { createFileRoute, Link } from '@tanstack/react-router'
import { AlertTriangle, ArrowRight, ClipboardCheck, Home, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { EmptyState, PrivateShell } from '@/components/portal/shell'
import { baselineConditionProductName } from '@/config/baseline-condition'
import { portalApi } from '@/lib/portal/api'
import type { CustomerInspectionListItem, PortalProfile, PortalProperty } from '@/lib/portal/types'

export const Route = createFileRoute('/portal/')({
  head: () => ({ meta: [{ title: 'Client Portal | GUARDEMAR' }, { name: 'robots', content: 'noindex, nofollow' }] }),
  component: PortalOverview,
})

function PortalOverview() {
  return <PrivateGuard area="portal">{(profile) => <Overview profile={profile} />}</PrivateGuard>
}

function Overview({ profile }: { profile: PortalProfile }) {
  const [properties, setProperties] = useState<PortalProperty[]>([])
  const [allInspections, setAllInspections] = useState<CustomerInspectionListItem[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { Promise.all([portalApi<{ properties: PortalProperty[] }>('properties').then((data) => setProperties(data.properties)), portalApi<{ inspections: CustomerInspectionListItem[] }>('inspections').then((data) => setAllInspections(data.inspections))]).finally(() => setLoading(false)) }, [])
  const firstName = profile.firstName || 'there'
  const inspections = allInspections.slice(0, 3)
  const pendingBaselines = allInspections.filter((inspection) => inspection.is_baseline && inspection.baseline_state && inspection.baseline_state !== 'acknowledged')

  return <PrivateShell area="portal" profile={profile} title={`Good morning, ${firstName}`} eyebrow="Here when you’re away.">
    {pendingBaselines.map((inspection) => <Link to="/portal/inspections/$id" params={{ id: inspection.id }} key={inspection.id} className="portal-notice warning baseline-action-banner"><AlertTriangle /><div><strong>Action required — Review your {baselineConditionProductName}</strong><p>{inspection.property_name}: please review and acknowledge your Initial Property Condition Report.</p></div></Link>)}
    {loading ? <div className="private-panel">Loading your properties…</div> : properties.length === 0 ? <EmptyState title="No properties are linked yet">Guardemar is preparing your private property access. Please contact us if you expected to see a property here.</EmptyState> : <><div className="portal-property-grid">{properties.map((property) => <article className="property-overview-card" key={property.id}><div className="property-card-icon"><Home /></div><p className="private-eyebrow">Your property</p><h2>{property.displayName}</h2><p>{property.locality} · {property.municipality}</p><div className="property-status"><ShieldCheck /><span><small>Property status</small>Ready for inspections</span></div><p className="muted-copy">Published inspection reports appear only after Guardemar’s internal review.</p><Link to="/portal/properties" className="private-secondary">View property <ArrowRight /></Link></article>)}</div>{inspections.length > 0 && <section className="private-panel recent-reports"><div className="panel-heading"><h2>Recent inspection reports</h2><Link to="/portal/inspections">View all</Link></div>{inspections.map((inspection) => <Link to="/portal/inspections/$id" params={{ id: inspection.id }} key={inspection.id}><ClipboardCheck /><span><strong>{inspection.property_name}</strong><small>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date(inspection.scheduled_for))}</small></span><b>{inspection.overall_condition.toUpperCase()}</b></Link>)}</section>}</>}
  </PrivateShell>
}
