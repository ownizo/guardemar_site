import { createFileRoute, Link } from '@tanstack/react-router'
import { ClipboardCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { StatusMark } from '@/components/portal/inspection-report'
import { EmptyState, PrivateShell } from '@/components/portal/shell'
import { portalApi } from '@/lib/portal/api'
import type { InspectionCondition, PortalProfile } from '@/lib/portal/types'

type CustomerInspection = { id: string; scheduled_for: string; published_at: string; available_until: string; is_available: boolean; days_remaining: number; property_name: string; locality: string; inspector_name: string | null; overall_condition: InspectionCondition }
export const Route = createFileRoute('/portal/inspections')({ component: InspectionsRoute })
function InspectionsRoute() { return <PrivateGuard area="portal">{(profile) => <InspectionList profile={profile} />}</PrivateGuard> }
function InspectionList({ profile }: { profile: PortalProfile }) {
  const [inspections, setInspections] = useState<CustomerInspection[]>([]); const [loading, setLoading] = useState(true)
  useEffect(() => { void portalApi<{ inspections: CustomerInspection[] }>('inspections').then((data) => setInspections(data.inspections)).finally(() => setLoading(false)) }, [])
  return <PrivateShell area="portal" profile={profile} title="Inspections" eyebrow="Reviewed Guardemar reports">{loading ? <div className="private-panel">Loading inspection reports…</div> : inspections.length === 0 ? <EmptyState title="No published inspections yet">Field visits remain private until Guardemar completes internal review and explicitly shares the report.</EmptyState> : <><p className="inspection-retention-intro">Inspection reports and photographs remain available in your Guardemar portal for 180 days after publication. We recommend downloading any files you wish to keep for your records.</p><div className="portal-report-list">{inspections.map((inspection) => inspection.is_available ? <Link to="/portal/inspections/$id" params={{ id: inspection.id }} key={inspection.id}><div className="list-icon"><ClipboardCheck /></div><div><p className="private-eyebrow">{new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(inspection.scheduled_for))}</p><h2>{inspection.property_name}</h2><p>{inspection.locality}{inspection.inspector_name ? ` · ${inspection.inspector_name}` : ''}</p><small>Available until {new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(inspection.available_until))}{inspection.days_remaining < 30 ? ` · ${inspection.days_remaining} days remaining` : ''}</small></div><StatusMark status={inspection.overall_condition} /></Link> : <article className="expired-inspection" key={inspection.id}><div className="list-icon"><ClipboardCheck /></div><div><p className="private-eyebrow">{new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(inspection.scheduled_for))}</p><h2>{inspection.property_name}</h2><strong>Inspection report expired</strong><p>Report and photographs are no longer available online.</p></div></article>)}</div></>}</PrivateShell>
}
