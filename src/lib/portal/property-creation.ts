export type AdminPropertyPayload = {
  clientId: string
  displayName: string
  addressLine1: string
  addressLine2: string
  postalCode: string
  locality: string
  municipality: string
  country: string
  propertyType: string
  bedrooms: number | null
  bathrooms: number | null
  hasPool: boolean
  hasGarden: boolean
  hasIrrigation: boolean
  hasAlarm: boolean
  accessNotesPrivate: string
  internalNotes: string
}

export type CreatedAdminProperty = { id: string; displayName: string }

/**
 * Builds the create-property payload from a submitted form.
 *
 * When `lockedClientId` is supplied (adding a property directly from a client's own
 * record) it always wins over whatever the form happens to contain, so the property
 * can never be attached to the wrong client regardless of what a hidden field holds.
 */
export function buildAdminPropertyPayload(form: FormData, lockedClientId?: string): AdminPropertyPayload {
  return {
    clientId: lockedClientId ?? String(form.get('clientId') ?? ''),
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
}

export async function createAdminPropertyWithRefresh({ payload, create, onCreated, refresh }: {
  payload: AdminPropertyPayload
  create: (payload: AdminPropertyPayload) => Promise<CreatedAdminProperty>
  onCreated: (property: CreatedAdminProperty) => void
  refresh: () => Promise<void>
}) {
  const created = await create(payload)
  let stateError: unknown = null
  let refreshError: unknown = null

  try {
    onCreated(created)
  } catch (error) {
    stateError = error
  }

  try {
    await refresh()
  } catch (error) {
    refreshError = error
  }

  return { created, stateError, refreshError }
}
