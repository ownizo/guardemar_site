import { type FormEvent, useRef, useState } from 'react'

import { portalApi } from '@/lib/portal/api'
import { buildAdminPropertyPayload, createAdminPropertyWithRefresh, type CreatedAdminProperty } from '@/lib/portal/property-creation'
import { acquireSubmissionLock } from '@/lib/portal/submission-lock'
import type { AdminClient } from '@/lib/portal/types'

export type PropertyFormNotice = { kind: 'success' | 'warning' | 'error'; message: string }

/**
 * Shared "Add property" form used both from the property directory (client chosen from
 * a dropdown) and from a client's own record (client fixed to that record, so staff
 * cannot accidentally attach the new property to the wrong client).
 */
export function PropertyCreateForm({ clients, lockedClient, onCancel, onCreated, refresh, onNotice }: {
  clients?: AdminClient[]
  lockedClient?: { id: string; name: string }
  onCancel: () => void
  onCreated: (property: CreatedAdminProperty) => void
  refresh: () => Promise<void>
  onNotice: (notice: PropertyFormNotice) => void
}) {
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const release = acquireSubmissionLock(pendingRef)
    if (!release) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const payload = buildAdminPropertyPayload(form, lockedClient?.id)

    setPending(true)
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
            onCreated(created)
            onNotice({ kind: 'success', message: `${created.displayName} was created successfully.` })
          },
          refresh,
        })
      } catch (error) {
        console.error('Property action failed', { code: 'CREATE_PROPERTY_ERROR', message: error instanceof Error ? error.message : 'Unknown error', stage: 'property_create' })
        onNotice({ kind: 'error', message: 'Please check the property information and try again.' })
        return
      }

      if (outcome.stateError) {
        console.error('Property action failed', { code: 'POST_CREATE_STATE_ERROR', message: outcome.stateError instanceof Error ? outcome.stateError.message : 'Unknown error', stage: 'property_post_create_state' })
        onNotice({ kind: 'warning', message: `${outcome.created.displayName} was created, but the page could not finish updating. Check the property list before taking any further action.` })
      } else if (outcome.refreshError) {
        console.error('Property action failed', { code: 'POST_CREATE_REFRESH_ERROR', message: outcome.refreshError instanceof Error ? outcome.refreshError.message : 'Unknown error', stage: 'property_post_create_refresh' })
        onNotice({ kind: 'warning', message: `${outcome.created.displayName} was created, but the property list could not refresh. The new property remains available below.` })
      }
    } finally {
      release()
      setPending(false)
    }
  }

  return <section className="private-panel create-panel">
    <div className="panel-heading"><h2>Add property</h2><p>{lockedClient ? <>For <strong>{lockedClient.name}</strong>. Private notes remain restricted to Guardemar staff.</> : 'Private notes remain restricted to Guardemar staff.'}</p></div>
    <form className="admin-form" onSubmit={submit}>
      {lockedClient
        ? <input type="hidden" name="clientId" value={lockedClient.id} />
        : <label>Client<select name="clientId" required defaultValue=""><option value="" disabled>Select client</option>{clients?.map((client) => <option key={client.id} value={client.id}>{client.firstName} {client.lastName}</option>)}</select></label>}
      <label>Display name<input name="displayName" placeholder="Casa da Luz" required /></label>
      <label className="full-field">Address line 1<input name="addressLine1" required /></label>
      <label className="full-field">Address line 2 <span>Optional</span><input name="addressLine2" /></label>
      <label>Postal code<input name="postalCode" required /></label>
      <label>Locality<input name="locality" required /></label>
      <label>Municipality<input name="municipality" required /></label>
      <label>Country<input name="country" defaultValue="Portugal" required /></label>
      <label>Property type<select name="propertyType" defaultValue="other"><option value="villa">Villa</option><option value="apartment">Apartment</option><option value="townhouse">Townhouse</option><option value="other">Other</option></select></label>
      <label>Bedrooms <span>Optional</span><input name="bedrooms" type="number" min="0" /></label>
      <label>Bathrooms <span>Optional</span><input name="bathrooms" type="number" min="0" /></label>
      <fieldset className="full-field feature-fields"><legend>Property features</legend><label><input type="checkbox" name="hasPool" />Pool</label><label><input type="checkbox" name="hasGarden" />Garden</label><label><input type="checkbox" name="hasIrrigation" />Irrigation</label><label><input type="checkbox" name="hasAlarm" />Alarm</label></fieldset>
      <label className="full-field sensitive-field">Access notes <span>Staff only · sensitive</span><textarea name="accessNotesPrivate" rows={3} /></label>
      <label className="full-field">Internal notes <span>Staff only</span><textarea name="internalNotes" rows={3} /></label>
      <div className="form-actions full-field"><button type="button" className="private-secondary" onClick={onCancel} disabled={pending}>Cancel</button><button className="private-primary" disabled={pending}>{pending ? 'Creating…' : 'Create property'}</button></div>
    </form>
  </section>
}
