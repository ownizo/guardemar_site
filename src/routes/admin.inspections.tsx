import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, ClipboardCheck, Plus } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { StatusMark, statusLabel } from '@/components/portal/inspection-report'
import { EmptyState, PrivateShell } from '@/components/portal/shell'
import { baselineStatusLabels } from '@/config/baseline-condition'
import { portalApi } from '@/lib/portal/api'
import type { AdminProperty, InspectionListItem, PortalProfile, StaffProfile } from '@/lib/portal/types'

type Template = { id: string; name: string; description: string | null; version: number }
export const Route = createFileRoute('/admin/inspections')({ component: InspectionsRoute })
function InspectionsRoute() { return <PrivateGuard area="admin">{(profile) => <Inspections profile={profile} />}</PrivateGuard> }

function Inspections({ profile }: { profile: PortalProfile }) {
  const navigate = useNavigate()
  const [inspections, setInspections] = useState<InspectionListItem[]>([])
  const [properties, setProperties] = useState<AdminProperty[]>([])
  const [team, setTeam] = useState<StaffProfile[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [showForm, setShowForm] = useState(false)
  const [pending, setPending] = useState(false)
  const [createError, setCreateError] = useState('')
  const [selectedPropertyId, setSelectedPropertyId] = useState('')
  const [status, setStatus] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [inspectorStaffId, setInspectorStaffId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const selectedProperty = properties.find((property) => property.id === selectedPropertyId)
  const propertyHasAreas = Boolean(selectedProperty && selectedProperty.activeAreaCount > 0)

  const load = () => {
    const params = new URLSearchParams({ status, propertyId, inspectorStaffId, dateFrom, dateTo })
    return portalApi<{ inspections: InspectionListItem[] }>(`admin/inspections?${params}`).then((data) => setInspections(data.inspections))
  }
  useEffect(() => { void Promise.all([load(), portalApi<{ properties: AdminProperty[]; team: StaffProfile[]; templates: Template[] }>('admin/inspection-options').then((data) => { setProperties(data.properties); setTeam(data.team.filter((member) => member.active)); setTemplates(data.templates) })]) }, [])
  useEffect(() => { void load() }, [status, propertyId, inspectorStaffId, dateFrom, dateTo])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !propertyHasAreas) return
    setPending(true)
    setCreateError('')
    const form = new FormData(event.currentTarget)
    try {
      const data = await portalApi<{ inspection: { id: string } }>('admin/inspections', {
        method: 'POST',
        body: JSON.stringify({ propertyId: form.get('propertyId'), templateId: form.get('templateId'), inspectorStaffId: form.get('inspectorStaffId'), scheduledFor: new Date(String(form.get('scheduledFor'))).toISOString(), idempotencyKey: crypto.randomUUID(), isBaseline: form.get('isBaseline') === 'on' }),
      })
      await navigate({ to: '/admin/inspections/$id', params: { id: data.inspection.id } })
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'The inspection could not be created.')
    } finally {
      setPending(false)
    }
  }

  return <PrivateShell area="admin" profile={profile} title="Inspections" eyebrow="Schedule, fieldwork, review and publishing" action={<button className="private-primary" onClick={() => setShowForm(!showForm)}><Plus />New inspection</button>}>
    {showForm && <section className="private-panel create-panel"><div className="panel-heading"><h2>Schedule inspection</h2><p>Creates an immutable snapshot from the property areas and selected template.</p></div><form className="admin-form" onSubmit={create}><label>Property<select name="propertyId" required value={selectedPropertyId} onChange={(event) => { setSelectedPropertyId(event.target.value); setCreateError('') }}><option value="">Select property</option>{properties.map((property) => <option value={property.id} key={property.id}>{property.displayName} — {property.locality}</option>)}</select></label><label>Template<select name="templateId" required><option value="">Select template</option>{templates.map((template) => <option value={template.id} key={template.id}>{template.name}</option>)}</select></label><label>Inspector<select name="inspectorStaffId" required><option value="">Select inspector</option>{team.map((member) => <option value={member.id} key={member.id}>{member.display_name}</option>)}</select></label><label>Scheduled date and time<input name="scheduledFor" type="datetime-local" required /></label><label className="check-field full-field baseline-designation-field"><input name="isBaseline" type="checkbox" /><span>This is the property’s <strong>Initial Property Condition Report</strong> (baseline, at commencement of service)</span></label>{selectedProperty && !propertyHasAreas && <div className="portal-notice warning inspection-area-warning full-field"><AlertTriangle /><div><strong>This property has no inspection areas configured.</strong><p>Add inspection areas before scheduling an inspection.</p><Link className="private-secondary compact" to="/admin/properties/$id" params={{ id: selectedProperty.id }}>Configure property areas</Link></div></div>}{createError && <p className="portal-notice warning full-field">{createError}</p>}<div className="form-actions full-field"><button type="button" className="private-secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="private-primary" disabled={pending || !propertyHasAreas}>{pending ? 'Creating…' : 'Create inspection'}</button></div></form></section>}
    <div className="inspection-filters"><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="scheduled">Upcoming</option><option value="in_progress">In progress</option><option value="awaiting_review">Awaiting review</option><option value="published">Published</option><option value="cancelled">Cancelled</option></select></label><label>Property<select value={propertyId} onChange={(event) => setPropertyId(event.target.value)}><option value="">All properties</option>{properties.map((property) => <option value={property.id} key={property.id}>{property.displayName}</option>)}</select></label><label>Inspector<select value={inspectorStaffId} onChange={(event) => setInspectorStaffId(event.target.value)}><option value="">All inspectors</option>{team.map((member) => <option value={member.id} key={member.id}>{member.display_name}</option>)}</select></label><label>From<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label><label>To<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label></div>
    {inspections.length === 0 ? <EmptyState title="No inspections found">Schedule the first visit after configuring the property’s inspection areas.</EmptyState> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Property</th><th>Inspector</th><th>Status</th><th>Condition</th><th></th></tr></thead><tbody>{inspections.map((inspection) => <tr key={inspection.id}><td>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(inspection.scheduled_for))}</td><td><strong>{inspection.property_name}</strong>{inspection.is_baseline && <span className="private-pill baseline-pill">Initial condition</span>}<br /><span>{inspection.locality}</span></td><td>{inspection.inspector_name}</td><td><span className="private-pill"><ClipboardCheck />{statusLabel(inspection.status)}</span>{inspection.is_baseline && inspection.baseline_state && <span className="private-pill baseline-pill">{baselineStatusLabels[inspection.baseline_state]}</span>}</td><td>{inspection.condition ? <StatusMark status={inspection.condition} /> : '—'}</td><td><Link className="private-secondary compact" to="/admin/inspections/$id" params={{ id: inspection.id }} aria-label={`Open inspection for ${inspection.property_name}`}>Open</Link></td></tr>)}</tbody></table></div>}
  </PrivateShell>
}
