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

export type PortalAccessStatus = 'not_activated' | 'invitation_pending' | 'active'

export type AdminClientPortalUser = {
  userId: string
  email: string
  displayName: string | null
  relationshipLabel: string | null
  status: PortalAccessStatus
  propertyIds: string[]
}

export type AdminClientPortalAccess = {
  users: AdminClientPortalUser[]
}

export type InvitedPortalUser = {
  userId: string
  email: string
  displayName: string
  status: 'invitation_pending'
  invitedAt: string
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
  activeAreaCount: number
}

export type InspectionResultStatus = 'good' | 'attention' | 'urgent' | 'not_checked' | 'not_applicable'
export type InspectionCondition = 'good' | 'attention' | 'urgent'
export type InspectionLifecycleStatus = 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'awaiting_review' | 'published' | 'cancelled'

export type StaffProfile = {
  id: string; user_id: string | null; first_name: string; last_name: string; display_name: string; role_title: string
  email: string | null; phone: string | null; active: boolean; show_on_client_reports: boolean
  internal_notes: string | null; profile_photo_path: string | null
}

export type PropertyArea = { id: string; property_id: string; area_type: string; custom_label: string; display_order: number; active: boolean; internal_notes: string | null }
export type InspectionListItem = { id: string; scheduled_for: string; property_id: string; property_name: string; locality: string; inspector_staff_id: string; inspector_name: string; status: InspectionLifecycleStatus; condition: InspectionCondition | null }
export type InspectionItem = { id: string; label: string; guidance?: string | null; display_order?: number; required?: boolean; status: InspectionResultStatus; observation: string | null; observation_client_visible?: boolean; recommendation: string | null; recommendation_client_visible?: boolean; updated_at?: string }
export type InspectionPhoto = { id: string; inspection_item_id?: string | null; storage_path: string; caption: string | null; display_order?: number; client_visible?: boolean }
export type InspectionArea = { id: string; area_type: string; custom_label: string; display_order: number; status: InspectionResultStatus; suggested_status: InspectionResultStatus; observation: string | null; observation_client_visible?: boolean; recommendation: string | null; recommendation_client_visible?: boolean; items: InspectionItem[]; photos: InspectionPhoto[] }
export type AdminInspectionDetail = { inspection: { id: string; status: InspectionLifecycleStatus; scheduled_for: string; started_at: string | null; completed_at: string | null; reviewed_at: string | null; published_at: string | null; suggested_condition: InspectionCondition | null; final_condition: InspectionCondition | null; client_summary: string | null; internal_review_notes: string | null; property_id: string; property_name: string; locality: string; inspector_staff_id: string; inspector_name: string }; areas: InspectionArea[] }
export type ClientInspectionReport = { id: string; scheduled_for: string; started_at?: string | null; completed_at?: string | null; published_at: string; available_until: string; days_remaining: number; property: { id: string; display_name: string; address_line_1?: string; address_line_2?: string | null; postal_code?: string; locality: string; municipality?: string; country?: string }; overall_condition: InspectionCondition; client_summary: string | null; inspector: { display_name: string; role_title: string; profile_photo_path: string | null } | null; areas: InspectionArea[] }
