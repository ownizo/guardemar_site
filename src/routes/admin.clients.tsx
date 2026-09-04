import { createFileRoute, Link } from '@tanstack/react-router'
import { LoaderCircle, Plus, Search, Trash2 } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { ConfirmDialog } from '@/components/portal/confirm-dialog'
import { EmptyState, PrivateShell } from '@/components/portal/shell'
import { PortalApiError, portalApi, type PortalErrorCode } from '@/lib/portal/api'
import { createAdminClientWithRefresh, type AdminClientPayload, type CreatedAdminClient } from '@/lib/portal/client-creation'
import type { AdminClient, BulkClientDeletionResult, ClientDeletionResult, PortalProfile } from '@/lib/portal/types'

type Notice = { kind: 'success' | 'warning' | 'error'; message: string }
type PendingDelete = { ids: string[]; names: string[]; linkedPropertyCount: number }

export const Route = createFileRoute('/admin/clients')({ component: AdminClients })

function AdminClients() {
  return <PrivateGuard area="admin">{(profile) => <ClientDirectory profile={profile} />}</PrivateGuard>
}

function reportPortalFailure(error: unknown, fallbackStage: string, fallbackCode: PortalErrorCode = 'NETWORK_ERROR') {
  if (error instanceof PortalApiError) {
    console.error('Portal action failed', { code: fallbackCode === 'NETWORK_ERROR' ? error.code : fallbackCode, message: error.message, details: error.details, hint: error.hint, status: error.status, stage: fallbackStage || error.stage })
    return error
  }
  console.error('Portal action failed', { code: fallbackCode, message: error instanceof Error ? error.message : 'Unknown error', status: 0, stage: fallbackStage })
  return new PortalApiError('The portal could not complete this request.', 0, fallbackCode, fallbackStage)
}

function creationErrorMessage(error: PortalApiError) {
  if (error.code === 'VALIDATION_ERROR') return 'Please check the client information and try again.'
  if (error.code === 'AUTHENTICATION_ERROR') return 'Your session has expired. Please sign in again.'
  if (error.code === 'AUTHORIZATION_ERROR') return 'You do not have permission to create clients.'
  if (error.code === 'CREATE_RPC_ERROR') return 'The client could not be created. Please review the information and try again.'
  return 'The result could not be confirmed. Check the client list before submitting again.'
}

function deletionReason(item: { reason?: string; dependencyCount?: number }) {
  if (item.reason === 'linked_properties') return `linked ${item.dependencyCount === 1 ? 'property' : 'properties'}`
  if (item.reason === 'linked_portal_users') return `linked portal ${item.dependencyCount === 1 ? 'user' : 'users'}`
  if (item.reason === 'not_found') return 'the record was not found'
  return 'a protected relationship'
}

function ClientDirectory({ profile }: { profile: PortalProfile }) {
  const [clients, setClients] = useState<AdminClient[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [createdClientId, setCreatedClientId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [deleting, setDeleting] = useState(false)
  const selectAllRef = useRef<HTMLInputElement>(null)

  async function load(query = '', clearSelection = false) {
    const data = await portalApi<{ clients: AdminClient[] }>(`admin/clients${query ? `?search=${encodeURIComponent(query)}` : ''}`)
    setClients(data.clients)
    if (clearSelection) setSelectedIds(new Set())
  }

  useEffect(() => { void load() }, [])

  const allVisibleSelected = clients.length > 0 && clients.every((client) => selectedIds.has(client.id))
  const someVisibleSelected = clients.some((client) => selectedIds.has(client.id))

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someVisibleSelected && !allVisibleSelected
  }, [allVisibleSelected, someVisibleSelected])

  async function createClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const payload: AdminClientPayload = {
      firstName: String(form.get('firstName') ?? ''),
      lastName: String(form.get('lastName') ?? ''),
      email: String(form.get('email') ?? ''),
      phone: String(form.get('phone') ?? ''),
      taxNumber: String(form.get('taxNumber') ?? ''),
      billingAddress: String(form.get('billingAddress') ?? ''),
      country: String(form.get('country') ?? ''),
      internalNotes: String(form.get('internalNotes') ?? ''),
    }

    submittingRef.current = true
    setSubmitting(true)
    setNotice(null)

    try {
      let outcome: Awaited<ReturnType<typeof createAdminClientWithRefresh>>
      try {
        outcome = await createAdminClientWithRefresh({
          payload,
          create: async (clientPayload) => {
            const result = await portalApi<{ client: CreatedAdminClient }>('admin/clients', { method: 'POST', body: JSON.stringify(clientPayload) })
            return result.client
          },
          onCreated: (created) => {
            setCreatedClientId(created.id)
            setClients((current) => current.some((client) => client.id === created.id) ? current : [{ ...created, taxNumber: payload.taxNumber || null, active: true, propertyCount: 0 }, ...current])
            formElement.reset()
            setShowForm(false)
            setNotice({ kind: 'success', message: `${created.firstName} ${created.lastName} was created successfully.` })
          },
          refresh: () => load(search),
        })
      } catch (error) {
        const portalError = reportPortalFailure(error, 'create_rpc')
        setNotice({ kind: 'error', message: creationErrorMessage(portalError) })
        return
      }

      if (outcome.stateError) {
        reportPortalFailure(outcome.stateError, 'post_create_state', 'POST_CREATE_REFRESH_ERROR')
        setCreatedClientId(outcome.created.id)
        setNotice({ kind: 'warning', message: `${outcome.created.firstName} ${outcome.created.lastName} was created successfully, but the page could not finish updating. Check the client list before taking any further action.` })
      } else if (outcome.refreshError) {
        reportPortalFailure(outcome.refreshError, 'post_create_refresh', 'POST_CREATE_REFRESH_ERROR')
        setNotice({ kind: 'warning', message: `${outcome.created.firstName} ${outcome.created.lastName} was created successfully, but the list could not refresh. The new record remains available below.` })
      }
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  function toggleClient(clientId: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(clientId)) next.delete(clientId)
      else next.add(clientId)
      return next
    })
  }

  function toggleAllVisible() {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(clients.map((client) => client.id)))
  }

  function requestDelete(client: AdminClient) {
    setPendingDelete({ ids: [client.id], names: [`${client.firstName} ${client.lastName}`], linkedPropertyCount: client.propertyCount })
  }

  function requestBulkDelete() {
    const selected = clients.filter((client) => selectedIds.has(client.id))
    setPendingDelete({ ids: selected.map((client) => client.id), names: selected.map((client) => `${client.firstName} ${client.lastName}`), linkedPropertyCount: selected.reduce((total, client) => total + client.propertyCount, 0) })
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return
    setDeleting(true)
    setNotice(null)
    try {
      const result = pendingDelete.ids.length === 1
        ? await portalApi<ClientDeletionResult>(`admin/clients/${pendingDelete.ids[0]}`, { method: 'DELETE' })
        : await portalApi<BulkClientDeletionResult>('admin/clients/bulk-delete', { method: 'POST', body: JSON.stringify({ clientIds: pendingDelete.ids }) })
      const deleted = typeof result.deleted === 'boolean' ? (result.deleted ? [{ id: result.id, name: result.name }] : []) : result.deleted
      const blocked = typeof result.deleted === 'boolean' ? (result.deleted ? [] : [result]) : result.blocked
      const deletedIds = new Set(deleted.map((item) => item.id))
      setClients((current) => current.filter((client) => !deletedIds.has(client.id)))
      setSelectedIds((current) => new Set([...current].filter((id) => !deletedIds.has(id))))

      if (deleted.length > 0 && blocked.length === 0) setNotice({ kind: 'success', message: `${deleted.length} ${deleted.length === 1 ? 'client was' : 'clients were'} deleted.` })
      else if (deleted.length > 0) setNotice({ kind: 'warning', message: `${deleted.length} ${deleted.length === 1 ? 'client was' : 'clients were'} deleted. ${blocked.length} ${blocked.length === 1 ? 'client was' : 'clients were'} not deleted because of ${deletionReason(blocked[0])}.` })
      else setNotice({ kind: 'error', message: `No clients were deleted. ${blocked[0]?.name ?? 'The client'} is protected by ${deletionReason(blocked[0] ?? {})}.` })
      setPendingDelete(null)
    } catch (error) {
      const portalError = reportPortalFailure(error, 'delete_rpc')
      setNotice({ kind: 'error', message: portalError.code === 'AUTHORIZATION_ERROR' ? 'Only an administrator can delete clients.' : 'The selected client records could not be deleted.' })
    } finally {
      setDeleting(false)
    }
  }

  return <PrivateShell area="admin" profile={profile} title="Clients" eyebrow="Private customer records" action={<button className="private-primary" onClick={() => setShowForm(!showForm)}><Plus />New client</button>}>
    {notice && <div className={`portal-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.message}{createdClientId && notice.kind !== 'error' && <Link to="/admin/clients/$id" params={{ id: createdClientId }}>View client</Link>}</div>}
    {showForm && <section className="private-panel create-panel"><div className="panel-heading"><h2>Add client</h2><p>Create the CRM record before adding a property or portal access.</p></div><form className="admin-form" onSubmit={createClient}><label>First name<input name="firstName" required /></label><label>Last name<input name="lastName" required /></label><label>Email<input name="email" type="email" required /></label><label>Telephone<input name="phone" type="tel" required /></label><label>Tax number <span>Optional</span><input name="taxNumber" /></label><label>Country<input name="country" defaultValue="Portugal" required /></label><label className="full-field">Billing address <span>Optional</span><textarea name="billingAddress" rows={2} /></label><label className="full-field">Internal notes <span>Staff only</span><textarea name="internalNotes" rows={3} /></label><div className="form-actions full-field"><button type="button" className="private-secondary" disabled={submitting} onClick={() => setShowForm(false)}>Cancel</button><button className="private-primary" disabled={submitting}>{submitting ? <><LoaderCircle className="spin" />Creating…</> : 'Create client'}</button></div></form></section>}
    <form className="directory-search" onSubmit={(event) => { event.preventDefault(); setNotice(null); void load(search, true).catch((error) => { reportPortalFailure(error, 'list_refresh'); setNotice({ kind: 'error', message: 'The client list could not be refreshed.' }) }) }}><Search /><label className="sr-only" htmlFor="client-search">Search clients</label><input id="client-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, telephone, tax number or address" /><button>Search</button></form>
    {profile.role === 'admin' && selectedIds.size > 0 && <div className="bulk-action-bar"><strong>{selectedIds.size} selected</strong><button type="button" className="private-danger compact" onClick={requestBulkDelete}><Trash2 />Delete selected ({selectedIds.size})</button></div>}
    {clients.length === 0 ? <EmptyState title="No clients found">Create the first Guardemar client record or adjust your search.</EmptyState> : <div className="data-table-wrap"><table className="data-table client-table"><thead><tr>{profile.role === 'admin' && <th className="selection-cell"><input ref={selectAllRef} type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Select all visible clients" /></th>}<th>Client</th><th>Contact</th><th>Tax number</th><th>Properties</th><th>Actions</th></tr></thead><tbody>{clients.map((client) => <tr key={client.id} className={selectedIds.has(client.id) ? 'selected-row' : undefined}>{profile.role === 'admin' && <td className="selection-cell"><input type="checkbox" checked={selectedIds.has(client.id)} onChange={() => toggleClient(client.id)} aria-label={`Select ${client.firstName} ${client.lastName}`} /></td>}<td><strong>{client.firstName} {client.lastName}</strong></td><td>{client.email}<br /><span>{client.phone}</span></td><td>{client.taxNumber || '—'}</td><td>{client.propertyCount}</td><td><div className="row-actions"><Link to="/admin/clients/$id" params={{ id: client.id }}>View</Link>{profile.role === 'admin' && <button type="button" className="text-danger" onClick={() => requestDelete(client)}>Delete</button>}</div></td></tr>)}</tbody></table></div>}
    {pendingDelete && <ConfirmDialog title={pendingDelete.ids.length === 1 ? `Delete ${pendingDelete.names[0]}?` : `Delete ${pendingDelete.ids.length} clients?`} confirmLabel={pendingDelete.ids.length === 1 ? 'Delete client' : `Delete ${pendingDelete.ids.length} clients`} busy={deleting} onCancel={() => setPendingDelete(null)} onConfirm={() => { void confirmDelete() }}><p>{pendingDelete.ids.length === 1 ? 'This action permanently deletes this client record and cannot be undone.' : 'Only clients without linked operational records can be deleted. Protected clients will remain in the directory.'}</p>{pendingDelete.linkedPropertyCount > 0 && <p className="confirm-warning">At least one selected client has linked properties and cannot be deleted until those records are removed or reassigned.</p>}</ConfirmDialog>}
  </PrivateShell>
}
