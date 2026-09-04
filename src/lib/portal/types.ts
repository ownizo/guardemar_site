export type ApplicationRole = 'customer' | 'staff' | 'admin'

export type PortalProfile = {
  id: string
  role: ApplicationRole
  firstName: string | null
  lastName: string | null
  phone: string | null
}

export type PortalProperty = {
  id: string
  displayName: string
  addressLine1: string
  addressLine2: string | null
  postalCode: string
  locality: string
  municipality: string
  country: string
  propertyType: 'villa' | 'apartment' | 'townhouse' | 'other'
}

export type AdminClient = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  taxNumber: string | null
  active: boolean
  propertyCount: number
}

export type ClientDeletionItem = {
  id: string
  name: string
  reason?: 'linked_properties' | 'linked_portal_users' | 'protected_relationship' | 'not_found'
  dependencyCount?: number
}

export type ClientDeletionResult = ClientDeletionItem & {
  deleted: boolean
}

export type BulkClientDeletionResult = {
  deleted: ClientDeletionItem[]
  blocked: ClientDeletionItem[]
}

export type AdminProperty = {
  id: string
  displayName: string
  addressLine1: string
  locality: string
  municipality: string
  propertyType: string
  active: boolean
  clientId: string
  clientName: string
}
