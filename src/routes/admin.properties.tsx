import { createFileRoute, Link } from '@tanstack/react-router'
import { Building2, Plus } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { EmptyState, PrivateShell } from '@/components/portal/shell'
import { portalApi } from '@/lib/portal/api'
import type { AdminClient, AdminProperty, PortalProfile } from '@/lib/portal/types'

export const Route = createFileRoute('/admin/properties')({ component: AdminProperties })

function AdminProperties() {
  return <PrivateGuard roles={['staff', 'admin']} loginPath="/admin/login">{(profile) => <PropertyDirectory profile={profile} />}</PrivateGuard>
}

function PropertyDirectory({ profile }: { profile: PortalProfile }) {
  const [properties, setProperties] = useState<AdminProperty[]>([])
  const [clients, setClients] = useState<AdminClient[]>([])
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

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
    const form = new FormData(event.currentTarget)
    const values = Object.fromEntries(form)
    const payload = {
      ...values,
      bedrooms: values.bedrooms ? Number(values.bedrooms) : null,
      bathrooms: values.bathrooms ? Number(values.bathrooms) : null,
      hasPool: form.has('hasPool'),
      hasGarden: form.has('hasGarden'),
      hasIrrigation: form.has('hasIrrigation'),
      hasAlarm: form.has('hasAlarm'),
    }
    try {
      await portalApi('admin/properties', { method: 'POST', body: JSON.stringify(payload) })
      event.currentTarget.reset()
      setShowForm(false)
      await load()
    } catch {
      setError('Please check the property information and try again.')
    }
  }

  return <PrivateShell area="admin" profile={profile} title="Properties" eyebrow="Property care records" action={<button className="private-primary" onClick={() => setShowForm(!showForm)}><Plus />New property</button>}>
    {showForm && <section className="private-panel create-panel"><div className="panel-heading"><h2>Add property</h2><p>Private notes remain restricted to Guardemar staff.</p></div><form className="admin-form" onSubmit={createProperty}><label>Client<select name="clientId" required defaultValue=""><option value="" disabled>Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.firstName} {client.lastName}</option>)}</select></label><label>Display name<input name="displayName" placeholder="Casa da Luz" required /></label><label className="full-field">Address line 1<input name="addressLine1" required /></label><label className="full-field">Address line 2 <span>Optional</span><input name="addressLine2" /></label><label>Postal code<input name="postalCode" required /></label><label>Locality<input name="locality" required /></label><label>Municipality<input name="municipality" required /></label><label>Country<input name="country" defaultValue="Portugal" required /></label><label>Property type<select name="propertyType" defaultValue="other"><option value="villa">Villa</option><option value="apartment">Apartment</option><option value="townhouse">Townhouse</option><option value="other">Other</option></select></label><label>Bedrooms <span>Optional</span><input name="bedrooms" type="number" min="0" /></label><label>Bathrooms <span>Optional</span><input name="bathrooms" type="number" min="0" /></label><fieldset className="full-field feature-fields"><legend>Property features</legend><label><input type="checkbox" name="hasPool" />Pool</label><label><input type="checkbox" name="hasGarden" />Garden</label><label><input type="checkbox" name="hasIrrigation" />Irrigation</label><label><input type="checkbox" name="hasAlarm" />Alarm</label></fieldset><label className="full-field sensitive-field">Access notes <span>Staff only · sensitive</span><textarea name="accessNotesPrivate" rows={3} /></label><label className="full-field">Internal notes <span>Staff only</span><textarea name="internalNotes" rows={3} /></label>{error && <p className="form-error full-field" role="alert">{error}</p>}<div className="form-actions full-field"><button type="button" className="private-secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="private-primary">Create property</button></div></form></section>}
    {properties.length === 0 ? <EmptyState title="No properties added">Create a client first, then add the property Guardemar cares for.</EmptyState> : <div className="private-list">{properties.map((property) => <Link to="/admin/properties/$id" params={{ id: property.id }} key={property.id}><div className="list-icon"><Building2 /></div><div><h2>{property.displayName}</h2><p>{property.addressLine1}, {property.locality}<br /><span>{property.clientName}</span></p></div><span className="private-pill">{property.active ? 'Active' : 'Inactive'}</span></Link>)}</div>}
  </PrivateShell>
}
