import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Building2, ChevronLeft, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { ClientPortalAccess } from '@/components/portal/client-portal-access'
import { ConfirmDialog } from '@/components/portal/confirm-dialog'
import { EmptyState, PrivateShell } from '@/components/portal/shell'
import { PortalApiError, portalApi } from '@/lib/portal/api'
import type { ClientDeletionResult, PortalProfile } from '@/lib/portal/types'

type ClientDetail = { id: string; firstName: string; lastName: string; email: string; phone: string; taxNumber: string | null; billingAddress: string | null; country: string; internalNotes: string | null; active: boolean }
type ClientProperty = { id: string; displayName: string; addressLine1: string; locality: string; municipality: string; active: boolean }

export const Route = createFileRoute('/admin/clients_/$id')({ component: ClientPage })

function ClientPage() {
  return <PrivateGuard area="admin">{(profile) => <ClientDetails profile={profile} />}</PrivateGuard>
}

function ClientDetails({ profile }: { profile: PortalProfile }) {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<{ client: ClientDetail; properties: ClientProperty[] } | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [notice, setNotice] = useState('')
  const [deleted, setDeleted] = useState(false)
  useEffect(() => { void portalApi<{ client: ClientDetail; properties: ClientProperty[] }>(`admin/clients/${id}`).then(setData) }, [id])
  if (!data) return <PrivateShell area="admin" profile={profile} title="Client record"><div className="private-panel">Loading client…</div></PrivateShell>
  const { client, properties } = data

  async function deleteClient() {
    if (deleting) return
    setDeleting(true)
    setNotice('')
    try {
      const result = await portalApi<ClientDeletionResult>(`admin/clients/${id}`, { method: 'DELETE' })
      if (!result.deleted) {
        const reason = result.reason === 'linked_properties' ? 'linked properties' : result.reason === 'linked_portal_users' ? 'linked portal users' : 'a protected relationship'
        setNotice(`This client cannot be deleted because it has ${reason}. Remove or reassign those records first.`)
        setShowDelete(false)
        return
      }
      setDeleted(true)
      setShowDelete(false)
      try {
        await navigate({ to: '/admin/clients', replace: true })
      } catch (error) {
        const navigationError = new PortalApiError(error instanceof Error ? error.message : 'Navigation failed.', 0, 'NAVIGATION_ERROR', 'navigation')
        console.error('Portal action failed', { code: navigationError.code, message: navigationError.message, status: navigationError.status, stage: navigationError.stage })
        setNotice(`${result.name} was deleted successfully, but the client list could not open. Use the Clients link to continue.`)
      }
    } catch (error) {
      const portalError = error instanceof PortalApiError ? error : new PortalApiError('The portal could not complete this request.', 0, 'NETWORK_ERROR', 'delete_rpc')
      console.error('Portal action failed', { code: portalError.code, message: portalError.message, details: portalError.details, hint: portalError.hint, status: portalError.status, stage: portalError.stage })
      setNotice(portalError.code === 'AUTHORIZATION_ERROR' ? 'Only an administrator can delete clients.' : 'This client could not be deleted.')
    } finally {
      setDeleting(false)
    }
  }

  if (deleted) return <PrivateShell area="admin" profile={profile} title="Client deleted" eyebrow="Client record"><div className="portal-notice success" role="status">{notice || `${client.firstName} ${client.lastName} was deleted successfully.`}<Link to="/admin/clients">Return to clients</Link></div></PrivateShell>

  return <PrivateShell area="admin" profile={profile} title={`${client.firstName} ${client.lastName}`} eyebrow="Client record" action={<div className="heading-actions"><Link className="private-secondary" to="/admin/clients"><ChevronLeft />Clients</Link>{profile.role === 'admin' && <button type="button" className="private-danger" onClick={() => setShowDelete(true)}><Trash2 />Delete client</button>}</div>}>
    {notice && <div className="portal-notice error" role="alert">{notice}</div>}
    <div className="record-grid"><section className="private-panel"><div className="panel-heading"><h2>Contact information</h2></div><dl className="details-list"><div><dt>Email</dt><dd>{client.email}</dd></div><div><dt>Telephone</dt><dd>{client.phone}</dd></div><div><dt>Tax number</dt><dd>{client.taxNumber || 'Not provided'}</dd></div><div><dt>Country</dt><dd>{client.country}</dd></div><div><dt>Billing address</dt><dd>{client.billingAddress || 'Not provided'}</dd></div></dl></section><section className="private-panel staff-only-panel"><div className="panel-heading"><h2>Internal notes</h2><span>Staff only</span></div><p>{client.internalNotes || 'No internal notes.'}</p></section></div>
    <section className="private-panel"><div className="panel-heading"><h2>Properties</h2><Link to="/admin/properties">Manage properties</Link></div>{properties.length === 0 ? <EmptyState title="No properties added">Add this client’s first property from the property directory.</EmptyState> : <div className="private-list compact">{properties.map((property) => <Link to="/admin/properties/$id" params={{ id: property.id }} key={property.id}><div className="list-icon"><Building2 /></div><div><h3>{property.displayName}</h3><p>{property.addressLine1}, {property.locality}</p></div><span className="private-pill">{property.active ? 'Active' : 'Inactive'}</span></Link>)}</div>}</section>
    {profile.role === 'admin' && <ClientPortalAccess clientId={client.id} clientFirstName={client.firstName} clientLastName={client.lastName} clientEmail={client.email} properties={properties} />}
    {showDelete && <ConfirmDialog title={`Delete ${client.firstName} ${client.lastName}?`} confirmLabel="Delete client" busy={deleting} onCancel={() => setShowDelete(false)} onConfirm={() => { void deleteClient() }}><p>This action permanently deletes this client record and cannot be undone.</p>{properties.length > 0 && <p className="confirm-warning">This client has linked properties and cannot be deleted until those records are removed or reassigned.</p>}</ConfirmDialog>}
  </PrivateShell>
}
