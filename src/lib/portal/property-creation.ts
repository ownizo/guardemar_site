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
