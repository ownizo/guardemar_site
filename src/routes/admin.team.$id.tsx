import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeft, Upload, UserRound } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { PrivateImage } from '@/components/portal/private-image'
import { PrivateShell } from '@/components/portal/shell'
import { portalApi } from '@/lib/portal/api'
import { validateStaffPhoto } from '@/lib/portal/staff-creation'
import { acquireSubmissionLock } from '@/lib/portal/submission-lock'
import { getPortalSupabase } from '@/lib/portal/supabase'
import type { PortalProfile, StaffProfile } from '@/lib/portal/types'

type Notice = { kind: 'success' | 'warning' | 'error'; message: string }

export const Route = createFileRoute('/admin/team/$id')({ component: TeamMemberRoute })
function TeamMemberRoute() { return <PrivateGuard area="admin">{(profile) => <TeamMember profile={profile} />}</PrivateGuard> }

function TeamMember({ profile }: { profile: PortalProfile }) {
  const { id } = Route.useParams()
  const [member, setMember] = useState<StaffProfile | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const saveLock = useRef(false)
  const photoLock = useRef(false)

  const load = () => portalApi<{ member: StaffProfile }>(`admin/team/${id}`).then((data) => setMember(data.member))
  useEffect(() => { void load() }, [id])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const release = acquireSubmissionLock(saveLock)
    if (!release) return
    const form = new FormData(event.currentTarget)
    setSaving(true)
    setNotice(null)

    try {
      let updated: StaffProfile
      try {
        const result = await portalApi<{ member: StaffProfile }>(`admin/team/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            firstName: form.get('firstName'),
            lastName: form.get('lastName'),
            displayName: form.get('displayName'),
            roleTitle: form.get('roleTitle'),
            email: form.get('email'),
            phone: form.get('phone'),
            internalNotes: form.get('internalNotes'),
            active: form.get('active') === 'on',
            showOnClientReports: form.get('showOnClientReports') === 'on',
          }),
        })
        updated = result.member
      } catch (error) {
        console.error('Team action failed', { code: 'UPDATE_STAFF_ERROR', message: error instanceof Error ? error.message : 'Unknown error', stage: 'staff_update' })
        setNotice({ kind: 'error', message: 'The collaborator details could not be saved.' })
        return
      }

      setMember(updated)
      setNotice({ kind: 'success', message: 'Collaborator details updated.' })
      try {
        await load()
      } catch (error) {
        console.error('Team action failed', { code: 'POST_UPDATE_REFRESH_ERROR', message: error instanceof Error ? error.message : 'Unknown error', stage: 'staff_post_update_refresh' })
        setNotice({ kind: 'warning', message: 'Collaborator details were saved, but the page could not refresh.' })
      }
    } finally {
      release()
      setSaving(false)
    }
  }

  async function uploadPhoto(file: File) {
    const validation = validateStaffPhoto(file)
    if (!validation.valid) {
      console.error('Team action failed', { code: 'PHOTO_VALIDATION_ERROR', message: validation.message, stage: 'staff_photo_validation' })
      setNotice({ kind: 'error', message: validation.message })
      return
    }

    const release = acquireSubmissionLock(photoLock)
    if (!release) return
    setUploading(true)
    setNotice(null)
    const path = `${id}/${crypto.randomUUID()}.${validation.extension}`

    try {
      try {
        const supabase = await getPortalSupabase()
        const { error } = await supabase.storage.from('staff-photos').upload(path, file, { contentType: file.type })
        if (error) throw error
      } catch (error) {
        console.error('Team action failed', { code: 'PHOTO_UPLOAD_ERROR', message: error instanceof Error ? error.message : 'Unknown error', stage: 'staff_photo_upload' })
        setNotice({ kind: 'warning', message: 'The profile photo could not be uploaded. Existing collaborator details are unchanged.' })
        return
      }

      let updated: StaffProfile
      try {
        const result = await portalApi<{ member: StaffProfile }>(`admin/team/${id}`, { method: 'PATCH', body: JSON.stringify({ profilePhotoPath: path }) })
        updated = result.member
      } catch (error) {
        console.error('Team action failed', { code: 'PHOTO_PROFILE_UPDATE_ERROR', message: error instanceof Error ? error.message : 'Unknown error', stage: 'staff_photo_profile_update' })
        setNotice({ kind: 'warning', message: 'The photo uploaded, but it could not be attached to the collaborator profile. Existing collaborator details are unchanged.' })
        return
      }

      setMember(updated)
      setNotice({ kind: 'success', message: 'Profile photo updated.' })
      try {
        await load()
      } catch (error) {
        console.error('Team action failed', { code: 'POST_UPDATE_REFRESH_ERROR', message: error instanceof Error ? error.message : 'Unknown error', stage: 'staff_photo_post_update_refresh' })
        setNotice({ kind: 'warning', message: 'Profile photo updated, but the page could not refresh.' })
      }
    } finally {
      release()
      setUploading(false)
    }
  }

  if (!member) return <PrivateShell area="admin" profile={profile} title="Team member"><div className="private-panel">Loading team member…</div></PrivateShell>
  return <PrivateShell area="admin" profile={profile} title={member.display_name} eyebrow={member.role_title} action={<Link className="private-secondary" to="/admin/team"><ChevronLeft />Team</Link>}>
    {notice && <div className={`portal-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.message}</div>}
    <section className="private-panel">
      <form className="admin-form" onSubmit={save}>
        <div className="profile-photo-panel full-field">
          {member.profile_photo_path ? <div className="team-avatar photo"><PrivateImage bucket="staff-photos" path={member.profile_photo_path} alt={member.display_name} /></div> : <div className="team-avatar"><UserRound /></div>}
          <div><strong>Profile photo</strong><small>Private storage · JPG, PNG or WebP · maximum 5 MB</small></div>
          <label className="private-secondary"><Upload />{uploading ? 'Uploading…' : 'Upload profile photo'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadPhoto(file) }} /></label>
        </div>
        <label>First name<input name="firstName" defaultValue={member.first_name} required /></label>
        <label>Last name<input name="lastName" defaultValue={member.last_name} required /></label>
        <label>Display name<input name="displayName" defaultValue={member.display_name} required /></label>
        <label>Title<input name="roleTitle" defaultValue={member.role_title} required /></label>
        <label>Email <span>Optional</span><input name="email" type="email" defaultValue={member.email ?? ''} /></label>
        <label>Telephone <span>Optional</span><input name="phone" defaultValue={member.phone ?? ''} /></label>
        <label className="full-field">Internal notes<textarea name="internalNotes" rows={3} defaultValue={member.internal_notes ?? ''} /></label>
        <label className="check-field"><input name="active" type="checkbox" defaultChecked={member.active} /> Active</label>
        <label className="check-field"><input name="showOnClientReports" type="checkbox" defaultChecked={member.show_on_client_reports} /> Show name and approved photo on client reports</label>
        <div className="form-actions full-field"><button className="private-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
      </form>
    </section>
  </PrivateShell>
}
