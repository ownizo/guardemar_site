export type AdminClientPayload = {
  firstName: string
  lastName: string
  email: string
  phone: string
  taxNumber: string
  billingAddress: string
  country: string
  internalNotes: string
}

export type CreatedAdminClient = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
}

export async function createAdminClientWithRefresh({ payload, create, onCreated, refresh }: { payload: AdminClientPayload; create: (payload: AdminClientPayload) => Promise<CreatedAdminClient>; onCreated: (client: CreatedAdminClient) => void; refresh: () => Promise<void> }) {
  const created = await create(payload)
  let stateError: unknown = null
  try {
    onCreated(created)
  } catch (error) {
    stateError = error
  }
  try {
    await refresh()
    return { created, stateError, refreshError: null }
  } catch (refreshError) {
    return { created, stateError, refreshError }
  }
}
