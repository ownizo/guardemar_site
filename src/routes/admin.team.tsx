import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus, Upload, UserRound } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { PrivateImage } from '@/components/portal/private-image'
import { EmptyState, PrivateShell } from '@/components/portal/shell'
import { portalApi } from '@/lib/portal/api'
import { getPortalSupabase } from '@/lib/portal/supabase'
import { createStaffWithPhoto, type AdminStaffPayload, validateStaffPhoto } from '@/lib/portal/staff-creation'
import { acquireSubmissionLock } from '@/lib/portal/submission-lock'
import type { PortalProfile, StaffProfile } from '@/lib/portal/types'

type Notice = { kind: 'success' | 'warning' | 'error'; message: string }

export const Route = createFileRoute('/admin/team')({ component: TeamRoute })
function TeamRoute() { return <PrivateGuard area="admin">{(profile) => <Team profile={profile} />}</PrivateGuard> }

function Team({ profile }: { profile: PortalProfile }) {
  const [team, setTeam] = useState<StaffProfile[]>([])
  const [creating, setCreating] = useState(false)
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoError, setPhotoError] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const load = () => portalApi<{ team: StaffProfile[] }>('admin/team').then((data) => setTeam(data.team))
  useEffect(() => { void load() }, [])

  function choosePhoto(file: File | null) {
    setPhotoError('')
    if (!file) {
      setPhoto(null)
      return
    }
    const validation = validateStaffPhoto(file)
    if (!validation.valid) {
      setPhoto(null)
      setPhotoError(validation.message)
      return
    }
    setPhoto(file)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (photoError) {
      setNotice({ kind: 'error', message: 'Choose a valid profile photo or clear the file selection before creating the collaborator.' })
      return
    }
    const release = acquireSubmissionLock(pendingRef)
    if (!release) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const payload: AdminStaffPayload = {
      firstName: String(form.get('firstName') ?? ''),
      lastName: String(form.get('lastName') ?? ''),
      displayName: String(form.get('displayName') ?? ''),
      roleTitle: String(form.get('roleTitle') ?? ''),
      email: String(form.get('email') ?? ''),
      phone: String(form.get('phone') ?? ''),
      internalNotes: String(form.get('internalNotes') ?? ''),
      active: true,
      showOnClientReports: form.get('showOnClientReports') === 'on',
    }

    setPending(true)
    setPhotoError('')
    setNotice(null)

    try {
      let outcome: Awaited<ReturnType<typeof createStaffWithPhoto>>
      try {
        outcome = await createStaffWithPhoto({
          payload,
          photo: photo ?? undefined,
          create: async (staffPayload) => {
            const result = await portalApi<{ member: StaffProfile }>('admin/team', { method: 'POST', body: JSON.stringify(staffPayload) })
            return result.member
          },
          onCreated: (created) => {
            setTeam((current) => current.some((member) => member.id === created.id) ? current : [created, ...current])
            formElement.reset()
            setPhoto(null)
            setCreating(false)
            setNotice({ kind: 'success', message: `${created.display_name} was created successfully.` })
          },
          uploadPhoto: async (created, selectedPhoto, extension) => {
            const path = `${created.id}/${crypto.randomUUID()}.${extension}`
            const supabase = await getPortalSupabase()
            const { error } = await supabase.storage.from('staff-photos').upload(path, selectedPhoto, { contentType: selectedPhoto.type })
            if (error) throw error
            return path
          },
          updatePhotoPath: async (created, path) => {
            const result = await portalApi<{ member: StaffProfile }>(`admin/team/${created.id}`, { method: 'PATCH', body: JSON.stringify({ profilePhotoPath: path }) })
            return result.member
          },
          onPhotoUpdated: (updated) => setTeam((current) => current.map((member) => member.id === updated.id ? updated : member)),
          refresh: load,
        })
      } catch (error) {
        console.error('Team action failed', { code: 'CREATE_STAFF_ERROR', message: error instanceof Error ? error.message : 'Unknown error', stage: 'staff_create' })
        setNotice({ kind: 'error', message: 'The team member could not be created.' })
        return
      }

      if (outcome.validationError) {
        console.error('Team action failed', { code: 'PHOTO_VALIDATION_ERROR', message: outcome.validationError, stage: 'staff_photo_validation' })
        setPhotoError(outcome.validationError)
      } else if (outcome.uploadError) {
        console.error('Team action failed', { code: 'PHOTO_UPLOAD_ERROR', message: outcome.uploadError instanceof Error ? outcome.uploadError.message : 'Unknown error', stage: 'staff_photo_upload' })
        setNotice({ kind: 'warning', message: 'Collaborator created, but the profile photo could not be uploaded. You can add it from the collaborator profile.' })
      } else if (outcome.profileUpdateError) {
        console.error('Team action failed', { code: 'PHOTO_PROFILE_UPDATE_ERROR', message: outcome.profileUpdateError instanceof Error ? outcome.profileUpdateError.message : 'Unknown error', stage: 'staff_photo_profile_update' })
        setNotice({ kind: 'warning', message: 'Collaborator created and the photo uploaded, but the profile could not be updated. You can add the photo again from the collaborator profile.' })
      } else if (outcome.stateError) {
        console.error('Team action failed', { code: 'POST_CREATE_STATE_ERROR', message: outcome.stateError instanceof Error ? outcome.stateError.message : 'Unknown error', stage: 'staff_post_create_state' })
        setNotice({ kind: 'warning', message: 'Collaborator created, but the page could not finish updating. Check the Team list before taking any further action.' })
      } else if (outcome.refreshError) {
        console.error('Team action failed', { code: 'POST_CREATE_REFRESH_ERROR', message: outcome.refreshError instanceof Error ? outcome.refreshError.message : 'Unknown error', stage: 'staff_post_create_refresh' })
        setNotice({ kind: 'warning', message: 'Collaborator created, but the Team list could not refresh. The new collaborator remains available below.' })
      }
    } finally {
      release()
      setPending(false)
    }
  }
  return <PrivateShell area="admin" profile={profile} title="Team" eyebrow="Operational collaborators" action={profile.role === 'admin' ? <button className="private-primary" onClick={() => setCreating(!creating)}><Plus />Add team member</button> : undefined}>
    {notice && <div className={`portal-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.message}</div>}
    {creating && <section className="private-panel create-panel"><div className="panel-heading"><h2>New collaborator</h2><p>No authentication account is required. Login access can be linked later if needed.</p></div><form className="admin-form" onSubmit={submit}><label>First name<input name="firstName" required /></label><label>Last name<input name="lastName" required /></label><label>Display name<input name="displayName" required /></label><label>Title<input name="roleTitle" placeholder="Property inspector" required /></label><label>Email <span>Optional</span><input name="email" type="email" /></label><label>Telephone <span>Optional</span><input name="phone" /></label><div className="photo-upload full-field"><div><strong>Profile photo</strong><span>Optional</span><small>JPG, PNG or WebP · maximum 5 MB</small></div><label className="private-secondary"><Upload />Choose photo<input name="profilePhoto" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => choosePhoto(event.target.files?.[0] ?? null)} /></label>{photo && <span className="selected-file">{photo.name}</span>}{photoError && <p className="form-error" role="alert">{photoError}</p>}</div><label className="full-field">Internal notes <span>Never client-visible</span><textarea name="internalNotes" rows={3} /></label><label className="check-field full-field"><input name="showOnClientReports" type="checkbox" defaultChecked /> Show name and approved photo on client reports</label><div className="form-actions full-field"><button type="button" className="private-secondary" onClick={() => { setCreating(false); setPhoto(null); setPhotoError('') }} disabled={pending}>Cancel</button><button className="private-primary" disabled={pending}>{pending ? 'Creating…' : 'Create collaborator'}</button></div></form></section>}
    {team.length === 0 ? <EmptyState title="No team members yet">Create the first operational collaborator without requiring login credentials.</EmptyState> : <div className="directory-grid">{team.map((member) => <Link to="/admin/team/$id" params={{ id: member.id }} className="team-card" key={member.id}>{member.profile_photo_path ? <div className="team-avatar photo"><PrivateImage bucket="staff-photos" path={member.profile_photo_path} alt={member.display_name} /></div> : <div className="team-avatar"><UserRound /></div>}<div><h2>{member.display_name}</h2><p>{member.role_title}</p><span className={`private-pill ${member.active ? '' : 'muted'}`}>{member.active ? 'Active' : 'Inactive'}</span></div></Link>)}</div>}
  </PrivateShell>
}
