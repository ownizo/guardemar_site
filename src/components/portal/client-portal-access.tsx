import { Check, KeyRound, Mail, Settings2, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'

import { ConfirmDialog } from './confirm-dialog'
import { PortalApiError, portalApi, portalInviteApi, type PortalErrorCode } from '@/lib/portal/api'
import { getPortalSupabase } from '@/lib/portal/supabase'
import type { AdminClientPortalAccess, AdminClientPortalUser, InvitedPortalUser, PortalAccessStatus } from '@/lib/portal/types'

type ClientProperty = { id: string; displayName: string; active: boolean }
type Feedback = { kind: 'success' | 'error' | 'warning'; code?: PortalErrorCode; message: string }
type PendingLink = { user: InvitedPortalUser; relationshipLabel: string }

const statusLabels: Record<PortalAccessStatus, string> = {
  not_activated: 'Not activated',
  invitation_pending: 'Invitation pending',
  active: 'Active',
}

function asPortalError(error: unknown, code: PortalErrorCode, stage: string) {
  return error instanceof PortalApiError
    ? error
    : new PortalApiError('The portal could not complete this request.', 0, code, stage)
}

export function ClientPortalAccess({ clientId, clientFirstName, clientLastName, clientEmail, properties }: {
  clientId: string
  clientFirstName: string
  clientLastName: string
  clientEmail: string
  properties: ClientProperty[]
}) {
  const [access, setAccess] = useState<AdminClientPortalAccess>({ users: [] })
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteBusy, setInviteBusy] = useState(false)
  const [firstName, setFirstName] = useState(clientFirstName)
  const [lastName, setLastName] = useState(clientLastName)
  const [email, setEmail] = useState(clientEmail)
  const [inviteRelationship, setInviteRelationship] = useState('Owner')
  const [pendingLink, setPendingLink] = useState<PendingLink | null>(null)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([])
  const [relationshipLabel, setRelationshipLabel] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const [revokeUser, setRevokeUser] = useState<AdminClientPortalUser | null>(null)
  const [revokeBusy, setRevokeBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [emailExistsFor, setEmailExistsFor] = useState<string | null>(null)
  const [resetSending, setResetSending] = useState(false)

  const activeProperties = useMemo(() => properties.filter((property) => property.active), [properties])
  const overallStatus: PortalAccessStatus = access.users.length === 0
    ? 'not_activated'
    : access.users.some((user) => user.status === 'active') ? 'active' : 'invitation_pending'
  const editingUser = access.users.find((user) => user.userId === editingUserId) ?? null

  async function loadAccess() {
    const result = await portalApi<{ portalAccess: AdminClientPortalAccess }>(`admin/clients/${clientId}/portal-access`)
    setAccess(result.portalAccess)
  }

  useEffect(() => {
    let active = true
    void loadAccess()
      .catch((error) => {
        if (!active) return
        const portalError = asPortalError(error, 'POST_SAVE_REFRESH_ERROR', 'portal_access_lookup')
        setFeedback({ kind: 'error', code: portalError.code, message: 'Portal access could not be loaded. Try refreshing this record.' })
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [clientId])

  async function refreshAfterSuccess(message: string) {
    try {
      await loadAccess()
      setFeedback({ kind: 'success', message })
    } catch (error) {
      const portalError = asPortalError(error, 'POST_SAVE_REFRESH_ERROR', 'portal_access_refresh')
      console.error('Portal action failed', { code: 'POST_SAVE_REFRESH_ERROR', message: portalError.message, status: portalError.status, stage: portalError.stage })
      setFeedback({ kind: 'warning', code: 'POST_SAVE_REFRESH_ERROR', message: `${message} The saved access is preserved, but the latest list could not be refreshed.` })
    }
  }

  function beginManage(user: AdminClientPortalUser) {
    setEditingUserId(user.userId)
    setSelectedPropertyIds(user.propertyIds.filter((propertyId) => properties.some((property) => property.id === propertyId)))
    setRelationshipLabel(user.relationshipLabel ?? '')
    setFeedback(null)
  }

  async function linkInvitedUser(link: PendingLink) {
    await portalApi(`admin/clients/${clientId}/portal-users/link`, {
      method: 'POST',
      body: JSON.stringify({ userId: link.user.userId, relationshipLabel: link.relationshipLabel }),
    })
    const linkedUser: AdminClientPortalUser = {
      userId: link.user.userId,
      email: link.user.email,
      displayName: link.user.displayName,
      relationshipLabel: link.relationshipLabel || null,
      status: 'invitation_pending',
      propertyIds: [],
    }
    setAccess((current) => ({ users: [...current.users.filter((user) => user.userId !== linkedUser.userId), linkedUser] }))
    setPendingLink(null)
    setShowInvite(false)
    beginManage(linkedUser)
    await refreshAfterSuccess(`Invitation sent to ${link.user.email} and linked to this client.`)
  }

  async function inviteUser(event: FormEvent) {
    event.preventDefault()
    if (inviteBusy) return
    setInviteBusy(true)
    setFeedback(null)
    setEmailExistsFor(null)
    try {
      const result = await portalInviteApi<{ invitedUser: InvitedPortalUser }>({ email, firstName, lastName })
      const link = { user: result.invitedUser, relationshipLabel: inviteRelationship.trim() }
      try {
        await linkInvitedUser(link)
      } catch (error) {
        const portalError = asPortalError(error, 'CLIENT_LINK_ERROR', 'client_link')
        console.error('Portal action failed', { code: 'CLIENT_LINK_ERROR', message: portalError.message, status: portalError.status, stage: portalError.stage })
        setPendingLink(link)
        setFeedback({ kind: 'error', code: 'CLIENT_LINK_ERROR', message: `The invitation was sent to ${result.invitedUser.email}, but the account could not be linked. Retry the link without sending another invitation.` })
      }
    } catch (error) {
      const portalError = asPortalError(error, 'AUTH_INVITE_ERROR', 'auth_invite')
      console.error('Portal action failed', { code: 'AUTH_INVITE_ERROR', message: portalError.message, status: portalError.status, stage: portalError.stage })
      if (portalError.stage === 'auth_invite_email_exists') {
        // This email already has an Auth identity, whether invited-but-never-activated
        // or already active. Both are correctly resolved the same way: a password reset
        // email. Offer exactly that action rather than a vague retry.
        setEmailExistsFor(email)
      } else {
        setFeedback({ kind: 'error', code: 'AUTH_INVITE_ERROR', message: portalError.message })
      }
    } finally {
      setInviteBusy(false)
    }
  }

  async function sendPasswordResetForExistingEmail() {
    if (!emailExistsFor || resetSending) return
    setResetSending(true)
    try {
      const supabase = await getPortalSupabase()
      await supabase.auth.resetPasswordForEmail(emailExistsFor, { redirectTo: `${window.location.origin}/auth/callback` })
      setFeedback({ kind: 'success', message: `A password reset link was sent to ${emailExistsFor}.` })
      setEmailExistsFor(null)
    } catch (error) {
      console.error('Portal action failed', { code: 'AUTH_INVITE_ERROR', message: error instanceof Error ? error.message : 'Unknown error', stage: 'send_password_reset' })
      setFeedback({ kind: 'error', code: 'AUTH_INVITE_ERROR', message: 'The password reset email could not be sent. Try again shortly.' })
    } finally {
      setResetSending(false)
    }
  }

  async function retryLink() {
    if (!pendingLink || inviteBusy) return
    setInviteBusy(true)
    setFeedback(null)
    try {
      await linkInvitedUser(pendingLink)
    } catch (error) {
      const portalError = asPortalError(error, 'CLIENT_LINK_ERROR', 'client_link_retry')
      setFeedback({ kind: 'error', code: 'CLIENT_LINK_ERROR', message: `The invitation remains sent, but the client link still failed. ${portalError.message}` })
    } finally {
      setInviteBusy(false)
    }
  }

  async function saveAccess(event: FormEvent) {
    event.preventDefault()
    if (!editingUser || saveBusy) return
    setSaveBusy(true)
    setFeedback(null)
    const safePropertyIds = selectedPropertyIds.filter((propertyId) => properties.some((property) => property.id === propertyId))
    try {
      try {
        await portalApi(`admin/clients/${clientId}/portal-users/link`, {
          method: 'POST',
          body: JSON.stringify({ userId: editingUser.userId, relationshipLabel: relationshipLabel.trim() }),
        })
      } catch (error) {
        const portalError = asPortalError(error, 'CLIENT_LINK_ERROR', 'client_link_update')
        throw new PortalApiError(portalError.message, portalError.status, 'CLIENT_LINK_ERROR', portalError.stage, portalError.details, portalError.hint)
      }
      try {
        await portalApi(`admin/clients/${clientId}/portal-users/${editingUser.userId}/properties`, {
          method: 'PUT',
          body: JSON.stringify({ propertyIds: safePropertyIds }),
        })
      } catch (error) {
        const portalError = asPortalError(error, 'PROPERTY_ACCESS_ERROR', 'property_access_save')
        throw new PortalApiError(portalError.message, portalError.status, 'PROPERTY_ACCESS_ERROR', portalError.stage, portalError.details, portalError.hint)
      }
      setAccess((current) => ({ users: current.users.map((user) => user.userId === editingUser.userId ? { ...user, relationshipLabel: relationshipLabel.trim() || null, propertyIds: safePropertyIds } : user) }))
      await refreshAfterSuccess(`Access saved for ${editingUser.displayName || editingUser.email}.`)
    } catch (error) {
      const portalError = asPortalError(error, 'PROPERTY_ACCESS_ERROR', 'property_access_save')
      const message = portalError.code === 'CLIENT_LINK_ERROR'
        ? 'The relationship could not be updated. Property access was not changed.'
        : 'The selected property access could not be saved.'
      setFeedback({ kind: 'error', code: portalError.code, message })
    } finally {
      setSaveBusy(false)
    }
  }

  async function revokeAccess() {
    if (!revokeUser || revokeBusy) return
    setRevokeBusy(true)
    setFeedback(null)
    try {
      await portalApi(`admin/clients/${clientId}/portal-users/${revokeUser.userId}`, { method: 'DELETE' })
      setAccess((current) => ({ users: current.users.filter((user) => user.userId !== revokeUser.userId) }))
      if (editingUserId === revokeUser.userId) setEditingUserId(null)
      const name = revokeUser.displayName || revokeUser.email
      setRevokeUser(null)
      await refreshAfterSuccess(`Portal access revoked for ${name}. The Auth account was not deleted.`)
    } catch (error) {
      const portalError = asPortalError(error, 'PROPERTY_ACCESS_ERROR', 'portal_access_revoke')
      setFeedback({ kind: 'error', code: portalError.code, message: 'Portal access could not be revoked.' })
    } finally {
      setRevokeBusy(false)
    }
  }

  return <section className="private-panel portal-access-panel">
    <div className="panel-heading portal-access-heading">
      <div><p className="private-eyebrow">Customer portal</p><h2>Portal access</h2></div>
      <span className={`portal-access-status ${overallStatus}`}><ShieldCheck />{statusLabels[overallStatus]}</span>
    </div>

    {feedback && <div className={`portal-notice ${feedback.kind === 'success' ? 'success' : feedback.kind === 'warning' ? 'warning' : 'error'}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.code && <strong>{feedback.code}</strong>}{feedback.message}</div>}

    {emailExistsFor && <div className="portal-link-recovery"><div><strong>{emailExistsFor} already has a Guardemar account</strong><p>Send a password reset instead of a new invitation — this works whether the account was never activated or the client has simply forgotten their password.</p></div><button type="button" className="private-secondary" onClick={() => { void sendPasswordResetForExistingEmail() }} disabled={resetSending}>{resetSending ? 'Sending…' : 'Send password reset'}</button></div>}

    {loading ? <p className="muted-copy">Loading portal access…</p> : <>
      {access.users.length === 0 ? <div className="portal-access-empty"><KeyRound /><div><h3>Portal access is not activated</h3><p>Invite the client or another authorised representative, then choose the properties they may view.</p></div></div> : <div className="portal-user-list">{access.users.map((user) => <article className="portal-user-card" key={user.userId}>
        <div className="portal-user-icon"><Users /></div>
        <div className="portal-user-identity"><h3>{user.displayName || user.email}</h3><p><Mail />{user.email || 'Email unavailable'}</p>{user.relationshipLabel && <span>{user.relationshipLabel}</span>}</div>
        <div className="portal-user-state"><span className={`private-pill portal-user-pill ${user.status}`}>{statusLabels[user.status]}</span><small>{user.propertyIds.length} {user.propertyIds.length === 1 ? 'property' : 'properties'}</small></div>
        <div className="portal-user-properties">{user.propertyIds.length === 0 ? <p>No property access assigned.</p> : user.propertyIds.map((propertyId) => {
          const property = properties.find((item) => item.id === propertyId)
          return property ? <span key={propertyId}><Check />{property.displayName}</span> : null
        })}</div>
        <div className="portal-user-actions"><button type="button" className="private-secondary" onClick={() => beginManage(user)}><Settings2 />Manage access</button><button type="button" className="private-danger" onClick={() => setRevokeUser(user)}><Trash2 />Revoke access</button></div>
      </article>)}</div>}

      <div className="portal-access-actions"><button type="button" className="private-primary" onClick={() => setShowInvite((visible) => !visible)}><UserPlus />Invite client to portal</button></div>

      {pendingLink && <div className="portal-link-recovery"><div><strong>Invitation sent; client link pending</strong><p>{pendingLink.user.email} already has an invitation. Retry only the secure CRM link.</p></div><button type="button" className="private-secondary" onClick={() => { void retryLink() }} disabled={inviteBusy}>{inviteBusy ? 'Retrying…' : 'Retry link'}</button></div>}

      {showInvite && <form className="portal-access-form" onSubmit={inviteUser}>
        <div className="portal-form-heading"><div><p className="private-eyebrow">Secure Auth invitation</p><h3>Invite portal user</h3></div><p>The invitation opens the Guardemar production password setup page.</p></div>
        <div className="form-grid"><label>First name<input value={firstName} onChange={(event) => setFirstName(event.target.value)} required /></label><label>Last name<input value={lastName} onChange={(event) => setLastName(event.target.value)} required /></label><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Relationship<input value={inviteRelationship} onChange={(event) => setInviteRelationship(event.target.value)} placeholder="Owner, spouse or representative" maxLength={120} /></label></div>
        <div className="form-actions"><button type="button" className="private-secondary" onClick={() => setShowInvite(false)}>Cancel</button><button className="private-primary" disabled={inviteBusy}>{inviteBusy ? 'Sending invitation…' : 'Send invitation'}</button></div>
      </form>}

      {editingUser && <form className="portal-access-form property-access-form" onSubmit={saveAccess}>
        <div className="portal-form-heading"><div><p className="private-eyebrow">Portal property access</p><h3>{editingUser.displayName || editingUser.email}</h3></div><button type="button" className="quiet-link" onClick={() => setEditingUserId(null)}>Close</button></div>
        <label className="relationship-field">Relationship<input value={relationshipLabel} onChange={(event) => setRelationshipLabel(event.target.value)} placeholder="Owner, spouse or representative" maxLength={120} /></label>
        {activeProperties.length === 0 ? <p className="muted-copy">This client has no active properties available for portal access.</p> : <fieldset className="property-access-options"><legend>Choose the properties this user can access</legend>{activeProperties.map((property) => <label key={property.id}><input type="checkbox" checked={selectedPropertyIds.includes(property.id)} onChange={(event) => setSelectedPropertyIds((current) => event.target.checked ? [...current, property.id] : current.filter((id) => id !== property.id))} /><span><Check />{property.displayName}</span></label>)}</fieldset>}
        <div className="form-actions"><button type="button" className="private-secondary" onClick={() => setEditingUserId(null)}>Cancel</button><button className="private-primary" disabled={saveBusy}>{saveBusy ? 'Saving access…' : 'Save access'}</button></div>
      </form>}
    </>}

    {revokeUser && <ConfirmDialog title={`Revoke access for ${revokeUser.displayName || revokeUser.email}?`} confirmLabel="Revoke portal access" busy={revokeBusy} onCancel={() => setRevokeUser(null)} onConfirm={() => { void revokeAccess() }}><p>This immediately removes the client and property relationships for this user.</p><p>The Supabase Auth account remains in place and is not deleted.</p></ConfirmDialog>}
  </section>
}
