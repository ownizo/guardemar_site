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
export type InspectionListItem = { id: string; scheduled_for: string; property_id: string; property_name: string; locality: string; inspector_staff_id: string; inspector_name: string; status: InspectionLifecycleStatus; condition: InspectionCondition | null; is_baseline: boolean; baseline_state: BaselineAcknowledgementState | null }
export type CustomerInspectionListItem = { id: string; scheduled_for: string; published_at: string; available_until: string; is_available: boolean; days_remaining: number; property_id: string; property_name: string; locality: string; inspector_name: string | null; overall_condition: InspectionCondition; is_baseline: boolean; baseline_state: BaselineAcknowledgementState | null; baseline_acknowledged_at: string | null }
export type InspectionItem = { id: string; label: string; guidance?: string | null; display_order?: number; required?: boolean; status: InspectionResultStatus; observation: string | null; observation_client_visible?: boolean; recommendation: string | null; recommendation_client_visible?: boolean; updated_at?: string }
// A media item is a photograph or a short (<=60s) video captured for an
// inspection area, up to 5 per area (any mix) -- see
// supabase/migrations/20260908150000_generalize_inspection_media.sql.
export type MediaType = 'image' | 'video'
export type InspectionMedia = {
  id: string
  inspection_item_id?: string | null
  media_type: MediaType
  storage_path: string
  poster_storage_path?: string | null
  duration_seconds?: number | null
  caption: string | null
  display_order?: number
  client_visible?: boolean
  original_filename?: string | null
  mime_type?: string | null
  file_size?: number | null
}
/** @deprecated kept only to type pre-migration frozen published_snapshot rows; use InspectionMedia. */
export type InspectionPhoto = { id: string; inspection_item_id?: string | null; storage_path: string; caption: string | null; display_order?: number; client_visible?: boolean }
export type InspectionArea = {
  id: string; area_type: string; custom_label: string; display_order: number
  status: InspectionResultStatus; suggested_status: InspectionResultStatus
  observation: string | null; observation_client_visible?: boolean
  recommendation: string | null; recommendation_client_visible?: boolean
  items: InspectionItem[]
  media?: InspectionMedia[]
  /** @deprecated present only on reports published before the media migration; use mediaForArea(area). */
  photos?: InspectionPhoto[]
  baseline?: { inspectionId: string; status: InspectionResultStatus; observation: string | null } | null
}

// Normalises an area's media regardless of whether it came from a live query
// (area.media, current shape) or a frozen published_snapshot created before
// the photos -> media migration (area.photos, image-only, no media_type).
// Every already-published report keeps rendering exactly as before.
export function mediaForArea(area: Pick<InspectionArea, 'media' | 'photos'>): InspectionMedia[] {
  if (area.media) return area.media
  return (area.photos ?? []).map((photo) => ({ ...photo, media_type: 'image' as const }))
}
export type AdminInspectionDetail = { inspection: { id: string; status: InspectionLifecycleStatus; scheduled_for: string; started_at: string | null; completed_at: string | null; reviewed_at: string | null; published_at: string | null; suggested_condition: InspectionCondition | null; final_condition: InspectionCondition | null; client_summary: string | null; internal_review_notes: string | null; property_id: string; property_name: string; locality: string; inspector_staff_id: string; inspector_name: string; is_baseline: boolean; baseline_state: BaselineAcknowledgementState | null; superseded_by: string | null }; areas: InspectionArea[] }
export type ClientInspectionReport = { id: string; scheduled_for: string; started_at?: string | null; completed_at?: string | null; published_at: string; available_until: string; days_remaining: number; property: { id: string; display_name: string; address_line_1?: string; address_line_2?: string | null; postal_code?: string; locality: string; municipality?: string; country?: string }; overall_condition: InspectionCondition; client_summary: string | null; inspector: { display_name: string; role_title: string; profile_photo_path: string | null } | null; areas: InspectionArea[] }

// Initial Property Condition Report (baseline condition record) -- General
// Terms v2.5, Clause 8. Layered on top of the existing inspection/report
// model rather than a parallel structure: see src/config/baseline-condition.ts
// for the canonical product name and acknowledgement wording.
export type BaselineAcknowledgementState = 'pending' | 'comments_received' | 'acknowledged'

export type BaselineComment = {
  id: string
  inspectionAreaId: string | null
  commentText: string
  createdAt: string
  staffResponseText: string | null
  staffRespondedAt: string | null
}

export type BaselineConditionStatus = {
  isBaseline: boolean
  baselineState: BaselineAcknowledgementState | null
  comments: BaselineComment[]
  acknowledgement: { acknowledgedAt: string; acknowledgementWording: { confirmation: string; scopeCaveat: string }; wordingVersion: string } | null
}

export type PropertyBaselineStatus = {
  inspectionId: string | null
  status: InspectionLifecycleStatus | null
  isBaseline: boolean
  baselineState: BaselineAcknowledgementState | null
  publishedAt?: string | null
  acknowledgedAt?: string | null
  openCommentCount?: number
}
