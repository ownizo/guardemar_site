import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeft, Upload } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { PrivateShell } from '@/components/portal/shell'
import { portalApi } from '@/lib/portal/api'
import { getPortalSupabase } from '@/lib/portal/supabase'
import type { PortalProfile, StaffProfile } from '@/lib/portal/types'

export const Route = createFileRoute('/admin/team/$id')({ component: TeamMemberRoute })
function TeamMemberRoute() { return <PrivateGuard area="admin">{(profile) => <TeamMember profile={profile} />}</PrivateGuard> }

function TeamMember({ profile }: { profile: PortalProfile }) {
  const { id } = Route.useParams(); const [member, setMember] = useState<StaffProfile | null>(null); const [notice, setNotice] = useState('')
  const load = () => portalApi<{ member: StaffProfile }>(`admin/team/${id}`).then((data) => setMember(data.member))
  useEffect(() => { void load() }, [id])
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await portalApi(`admin/team/${id}`, { method: 'PATCH', body: JSON.stringify({ firstName: form.get('firstName'), lastName: form.get('lastName'), displayName: form.get('displayName'), roleTitle: form.get('roleTitle'), email: form.get('email'), phone: form.get('phone'), internalNotes: form.get('internalNotes'), active: form.get('active') === 'on', showOnClientReports: form.get('showOnClientReports') === 'on' }) }); setNotice('Team member updated.'); await load() }
  async function photo(file: File) { if (!file.type.match(/^image\/(jpeg|png|webp)$/) || file.size > 5 * 1024 * 1024) { setNotice('Use a JPG, PNG or WebP image under 5 MB.'); return } const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'; const path = `${id}/${crypto.randomUUID()}.${extension}`; const supabase = await getPortalSupabase(); const { error } = await supabase.storage.from('staff-photos').upload(path, file, { contentType: file.type }); if (error) { setNotice('Photo upload failed.'); return } await portalApi(`admin/team/${id}`, { method: 'PATCH', body: JSON.stringify({ profilePhotoPath: path }) }); setNotice('Profile photo updated.'); await load() }
  if (!member) return <PrivateShell area="admin" profile={profile} title="Team member"><div className="private-panel">Loading team member…</div></PrivateShell>
  return <PrivateShell area="admin" profile={profile} title={member.display_name} eyebrow={member.role_title} action={<Link className="private-secondary" to="/admin/team"><ChevronLeft />Team</Link>}><section className="private-panel"><form className="admin-form" onSubmit={save}><label>First name<input name="firstName" defaultValue={member.first_name} required /></label><label>Last name<input name="lastName" defaultValue={member.last_name} required /></label><label>Display name<input name="displayName" defaultValue={member.display_name} required /></label><label>Title<input name="roleTitle" defaultValue={member.role_title} required /></label><label>Email<input name="email" type="email" defaultValue={member.email ?? ''} /></label><label>Telephone<input name="phone" defaultValue={member.phone ?? ''} /></label><label className="full-field">Internal notes<textarea name="internalNotes" rows={3} defaultValue={member.internal_notes ?? ''} /></label><label className="check-field"><input name="active" type="checkbox" defaultChecked={member.active} /> Active</label><label className="check-field"><input name="showOnClientReports" type="checkbox" defaultChecked={member.show_on_client_reports} /> Show on client reports</label><div className="photo-upload full-field"><label className="private-secondary"><Upload />Upload profile photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void photo(file) }} /></label><small>Private storage · JPG, PNG or WebP · maximum 5 MB</small></div>{notice && <p className="form-notice full-field">{notice}</p>}<div className="form-actions full-field"><button className="private-primary">Save changes</button></div></form></section></PrivateShell>
}
