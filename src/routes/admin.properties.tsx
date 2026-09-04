import { createFileRoute, Link } from '@tanstack/react-router'
import { Building2, Plus } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { EmptyState, PrivateShell } from '@/components/portal/shell'
import { portalApi } from '@/lib/portal/api'
import { createAdminPropertyWithRefresh, type AdminPropertyPayload, type CreatedAdminProperty } from '@/lib/portal/property-creation'
import { acquireSubmissionLock } from '@/lib/portal/submission-lock'
import type { AdminClient, AdminProperty, PortalProfile } from '@/lib/portal/types'

type Notice = { kind: 'success' | 'warning' | 'error'; message: string }

export const Route = createFileRoute('/admin/properties')({ component: AdminProperties })

function AdminProperties() {
  return <PrivateGuard area="admin">{(profile) => <PropertyDirectory profile={profile} />}</PrivateGuard>
}

function PropertyDirectory({ profile }: { profile: PortalProfile }) {
  const [properties, setProperties] = useState<AdminProperty[]>([])
  const [clients, setClients] = useState<AdminClient[]>([])
  const [showForm, setShowForm] = useState(false)
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  async function load() {
    const [propertyData, clientData] = await Promise.all([
      portalApi<{ properties: AdminProperty[] }>('admin/properties'),
      portalApi<{ clients: AdminClient[] }>('admin/clients'),
    ])
    setProperties(propertyData.properties)
    setClients(clientData.clients)
  }
  useEffect(() => { void load() }, [])

  async function createProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const release = acquireSubmissionLock(pendingRef)
    if (!release) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const payload: AdminPropertyPayload = {
      clientId: String(form.get('clientId') ?? ''),
      displayName: String(form.get('displayName') ?? ''),
      addressLine1: String(form.get('addressLine1') ?? ''),
      addressLine2: String(form.get('addressLine2') ?? ''),
      postalCode: String(form.get('postalCode') ?? ''),
      locality: String(form.get('locality') ?? ''),
      municipality: String(form.get('municipality') ?? ''),
      country: String(form.get('country') ?? ''),
      propertyType: String(form.get('propertyType') ?? 'other'),
      bedrooms: form.get('bedrooms') ? Number(form.get('bedrooms')) : null,
      bathrooms: form.get('bathrooms') ? Number(form.get('bathrooms')) : null,
      hasPool: form.has('hasPool'),
      hasGarden: form.has('hasGarden'),
      hasIrrigation: form.has('hasIrrigation'),
      hasAlarm: form.has('hasAlarm'),
      accessNotesPrivate: String(form.get('accessNotesPrivate') ?? ''),
      internalNotes: String(form.get('internalNotes') ?? ''),
    }

    setPending(true)
    setNotice(null)
    try {
      let outcome: Awaited<ReturnType<typeof createAdminPropertyWithRefresh>>
      try {
        outcome = await createAdminPropertyWithRefresh({
          payload,
          create: async (propertyPayload) => {
            const result = await portalApi<{ property: CreatedAdminProperty }>('admin/properties', { method: 'POST', body: JSON.stringify(propertyPayload) })
            return result.property
          },
          onCreated: (created) => {
            formElement.reset()
            setShowForm(false)
            setNotice({ kind: 'success', message: `${created.displayName} was created successfully.` })
          },
          refresh: load,
        })
      } catch (error) {
        console.error('Property action failed', { code: 'CREATE_PROPERTY_ERROR', message: error instanceof Error ? error.message : 'Unknown error', stage: 'property_create' })
        setNotice({ kind: 'error', message: 'Please check the property information and try again.' })
        return
      }

      if (outcome.stateError) {
        console.error('Property action failed', { code: 'POST_CREATE_STATE_ERROR', message: outcome.stateError instanceof Error ? outcome.stateError.message : 'Unknown error', stage: 'property_post_create_state' })
        setNotice({ kind: 'warning', message: `${outcome.created.displayName} was created, but the page could not finish updating. Check the property list before taking any further action.` })
      } else if (outcome.refreshError) {
        console.error('Property action failed', { code: 'POST_CREATE_REFRESH_ERROR', message: outcome.refreshError instanceof Error ? outcome.refreshError.message : 'Unknown error', stage: 'property_post_create_refresh' })
        setNotice({ kind: 'warning', message: `${outcome.created.displayName} was created, but the property list could not refresh. The new property remains available below.` })
      }
    } finally {
      release()
      setPending(false)
    }
  }

  return <PrivateShell area="admin" profile={profile} title="Properties" eyebrow="Property care records" action={<button className="private-primary" onClick={() => setShowForm(!showForm)}><Plus />New property</button>}>
    {notice && <div className={`portal-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.message}</div>}
    {showForm && <section className="private-panel create-panel"><div className="panel-heading"><h2>Add property</h2><p>Private notes remain restricted to Guardemar staff.</p></div><form className="admin-form" onSubmit={createProperty}><label>Client<select name="clientId" required defaultValue=""><option value="" disabled>Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.firstName} {client.lastName}</option>)}</select></label><label>Display name<input name="displayName" placeholder="Casa da Luz" required /></label><label className="full-field">Address line 1<input name="addressLine1" required /></label><label className="full-field">Address line 2 <span>Optional</span><input name="addressLine2" /></label><label>Postal code<input name="postalCode" required /></label><label>Locality<input name="locality" required /></label><label>Municipality<input name="municipality" required /></label><label>Country<input name="country" defaultValue="Portugal" required /></label><label>Property type<select name="propertyType" defaultValue="other"><option value="villa">Villa</option><option value="apartment">Apartment</option><option value="townhouse">Townhouse</option><option value="other">Other</option></select></label><label>Bedrooms <span>Optional</span><input name="bedrooms" type="number" min="0" /></label><label>Bathrooms <span>Optional</span><input name="bathrooms" type="number" min="0" /></label><fieldset className="full-field feature-fields"><legend>Property features</legend><label><input type="checkbox" name="hasPool" />Pool</label><label><input type="checkbox" name="hasGarden" />Garden</label><label><input type="checkbox" name="hasIrrigation" />Irrigation</label><label><input type="checkbox" name="hasAlarm" />Alarm</label></fieldset><label className="full-field sensitive-field">Access notes <span>Staff only · sensitive</span><textarea name="accessNotesPrivate" rows={3} /></label><label className="full-field">Internal notes <span>Staff only</span><textarea name="internalNotes" rows={3} /></label><div className="form-actions full-field"><button type="button" className="private-secondary" onClick={() => setShowForm(false)} disabled={pending}>Cancel</button><button className="private-primary" disabled={pending}>{pending ? 'Creating…' : 'Create property'}</button></div></form></section>}
    {properties.length === 0 ? <EmptyState title="No properties added">Create a client first, then add the property Guardemar cares for.</EmptyState> : <div className="private-list">{properties.map((property) => <Link to="/admin/properties/$id" params={{ id: property.id }} key={property.id}><div className="list-icon"><Building2 /></div><div><h2>{property.displayName}</h2><p>{property.addressLine1}, {property.locality}<br /><span>{property.clientName}</span></p></div><span className="private-pill">{property.active ? 'Active' : 'Inactive'}</span></Link>)}</div>}
  </PrivateShell>
}
