import { createFileRoute, Link } from '@tanstack/react-router'
import { Building2, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { PropertyCreateForm, type PropertyFormNotice } from '@/components/portal/property-create-form'
import { EmptyState, PrivateShell } from '@/components/portal/shell'
import { portalApi } from '@/lib/portal/api'
import type { AdminClient, AdminProperty, PortalProfile } from '@/lib/portal/types'

export const Route = createFileRoute('/admin/properties')({ component: AdminProperties })

function AdminProperties() {
  return <PrivateGuard area="admin">{(profile) => <PropertyDirectory profile={profile} />}</PrivateGuard>
}

function PropertyDirectory({ profile }: { profile: PortalProfile }) {
  const [properties, setProperties] = useState<AdminProperty[]>([])
  const [clients, setClients] = useState<AdminClient[]>([])
  const [showForm, setShowForm] = useState(false)
  const [notice, setNotice] = useState<PropertyFormNotice | null>(null)

  async function load() {
    const [propertyData, clientData] = await Promise.all([
      portalApi<{ properties: AdminProperty[] }>('admin/properties'),
      portalApi<{ clients: AdminClient[] }>('admin/clients'),
    ])
    setProperties(propertyData.properties)
    setClients(clientData.clients)
  }
  useEffect(() => { void load() }, [])

  return <PrivateShell area="admin" profile={profile} title="Properties" eyebrow="Property care records" action={<button className="private-primary" onClick={() => setShowForm(!showForm)}><Plus />New property</button>}>
    {notice && <div className={`portal-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.message}</div>}
    {showForm && <PropertyCreateForm clients={clients} onCancel={() => setShowForm(false)} onCreated={() => setShowForm(false)} refresh={load} onNotice={setNotice} />}
    {properties.length === 0 ? <EmptyState title="No properties added">Create a client first, then add the property Guardemar cares for.</EmptyState> : <div className="private-list">{properties.map((property) => <Link to="/admin/properties/$id" params={{ id: property.id }} key={property.id}><div className="list-icon"><Building2 /></div><div><h2>{property.displayName}</h2><p>{property.addressLine1}, {property.locality}<br /><span>{property.clientName}</span></p></div><span className="private-pill">{property.active ? 'Active' : 'Inactive'}</span></Link>)}</div>}
  </PrivateShell>
}
