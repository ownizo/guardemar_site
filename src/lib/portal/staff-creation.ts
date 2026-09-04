import type { StaffProfile } from './types'

export const STAFF_PHOTO_MAX_BYTES = 5 * 1024 * 1024
export const STAFF_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export type StaffPhoto = Pick<File, 'name' | 'size' | 'type'>

export type AdminStaffPayload = {
  firstName: string
  lastName: string
  displayName: string
  roleTitle: string
  email: string
  phone: string
  internalNotes: string
  active: boolean
  showOnClientReports: boolean
}

export type StaffPhotoValidation =
  | { valid: true; extension: 'jpg' | 'png' | 'webp' }
  | { valid: false; message: string }

export function validateStaffPhoto(file: StaffPhoto): StaffPhotoValidation {
  if (!STAFF_PHOTO_TYPES.includes(file.type as typeof STAFF_PHOTO_TYPES[number])) {
    return { valid: false, message: 'Choose a JPG, PNG or WebP image.' }
  }
  if (file.size > STAFF_PHOTO_MAX_BYTES) {
    return { valid: false, message: 'Choose an image no larger than 5 MB.' }
  }
  return { valid: true, extension: file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp' }
}

export async function createStaffWithPhoto({ payload, photo, create, onCreated, uploadPhoto, updatePhotoPath, onPhotoUpdated, refresh }: {
  payload: AdminStaffPayload
  photo?: File
  create: (payload: AdminStaffPayload) => Promise<StaffProfile>
  onCreated: (member: StaffProfile) => void
  uploadPhoto: (member: StaffProfile, photo: File, extension: 'jpg' | 'png' | 'webp') => Promise<string>
  updatePhotoPath: (member: StaffProfile, path: string) => Promise<StaffProfile>
  onPhotoUpdated: (member: StaffProfile) => void
  refresh: () => Promise<void>
}) {
  const validation = photo ? validateStaffPhoto(photo) : null
  if (validation && !validation.valid) return { created: null, validationError: validation.message, stateError: null, uploadError: null, profileUpdateError: null, refreshError: null }

  const created = await create(payload)
  let stateError: unknown = null
  let uploadError: unknown = null
  let profileUpdateError: unknown = null
  let refreshError: unknown = null
  let updated = created

  try {
    onCreated(created)
  } catch (error) {
    stateError = error
  }

  if (photo && validation?.valid) {
    try {
      const path = await uploadPhoto(created, photo, validation.extension)
      try {
        updated = await updatePhotoPath(created, path)
      } catch (error) {
        profileUpdateError = error
      }
      if (!profileUpdateError) {
        try {
          onPhotoUpdated(updated)
        } catch (error) {
          stateError ??= error
        }
      }
    } catch (error) {
      uploadError = error
    }
  }

  try {
    await refresh()
  } catch (error) {
    refreshError = error
  }

  return { created, updated, validationError: null, stateError, uploadError, profileUpdateError, refreshError }
}
