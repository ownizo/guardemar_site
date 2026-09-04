import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus, Search } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { EmptyState, PrivateShell } from '@/components/portal/shell'
import { portalApi } from '@/lib/portal/api'
import type { AdminClient, PortalProfile } from '@/lib/portal/types'

export const Route = createFileRoute('/admin/clients')({ component: AdminClients })

function AdminClients() {
  return <PrivateGuard area="admin">{(profile) => <ClientDirectory profile={profile} />}</PrivateGuard>
}

function ClientDirectory({ profile }: { profile: PortalProfile }) {
  const [clients, setClients] = useState<AdminClient[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  async function load(query = '') {
    const data = await portalApi<{ clients: AdminClient[] }>(`admin/clients${query ? `?search=${encodeURIComponent(query)}` : ''}`)
    setClients(data.clients)
  }
  useEffect(() => { void load() }, [])

  async function createClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      await portalApi('admin/clients', { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) })
      event.currentTarget.reset()
      setShowForm(false)
      await load(search)
    } catch {
      setError('Please check the client information and try again.')
    }
  }

  return <PrivateShell area="admin" profile={profile} title="Clients" eyebrow="Private customer records" action={<button className="private-primary" onClick={() => setShowForm(!showForm)}><Plus />New client</button>}>
    {showForm && <section className="private-panel create-panel"><div className="panel-heading"><h2>Add client</h2><p>Create the CRM record before adding a property or portal access.</p></div><form className="admin-form" onSubmit={createClient}><label>First name<input name="firstName" required /></label><label>Last name<input name="lastName" required /></label><label>Email<input name="email" type="email" required /></label><label>Telephone<input name="phone" type="tel" required /></label><label>Tax number <span>Optional</span><input name="taxNumber" /></label><label>Country<input name="country" defaultValue="Portugal" required /></label><label className="full-field">Billing address <span>Optional</span><textarea name="billingAddress" rows={2} /></label><label className="full-field">Internal notes <span>Staff only</span><textarea name="internalNotes" rows={3} /></label>{error && <p className="form-error full-field" role="alert">{error}</p>}<div className="form-actions full-field"><button type="button" className="private-secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="private-primary">Create client</button></div></form></section>}
    <form className="directory-search" onSubmit={(event) => { event.preventDefault(); void load(search) }}><Search /><label className="sr-only" htmlFor="client-search">Search clients</label><input id="client-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, telephone, tax number or address" /><button>Search</button></form>
    {clients.length === 0 ? <EmptyState title="No clients found">Create the first Guardemar client record or adjust your search.</EmptyState> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Client</th><th>Contact</th><th>Tax number</th><th>Properties</th><th></th></tr></thead><tbody>{clients.map((client) => <tr key={client.id}><td><strong>{client.firstName} {client.lastName}</strong></td><td>{client.email}<br /><span>{client.phone}</span></td><td>{client.taxNumber || '—'}</td><td>{client.propertyCount}</td><td><Link to="/admin/clients/$id" params={{ id: client.id }}>View</Link></td></tr>)}</tbody></table></div>}
  </PrivateShell>
}
