import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus, UserRound } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { PrivateImage } from '@/components/portal/private-image'
import { EmptyState, PrivateShell } from '@/components/portal/shell'
import { portalApi } from '@/lib/portal/api'
import type { PortalProfile, StaffProfile } from '@/lib/portal/types'

export const Route = createFileRoute('/admin/team')({ component: TeamRoute })
function TeamRoute() { return <PrivateGuard area="admin">{(profile) => <Team profile={profile} />}</PrivateGuard> }

function Team({ profile }: { profile: PortalProfile }) {
  const [team, setTeam] = useState<StaffProfile[]>([]); const [creating, setCreating] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState('')
  const load = () => portalApi<{ team: StaffProfile[] }>('admin/team').then((data) => setTeam(data.team))
  useEffect(() => { void load() }, [])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return; setPending(true); setError('')
    const form = new FormData(event.currentTarget)
    try { await portalApi('admin/team', { method: 'POST', body: JSON.stringify({ firstName: form.get('firstName'), lastName: form.get('lastName'), displayName: form.get('displayName'), roleTitle: form.get('roleTitle'), email: form.get('email'), phone: form.get('phone'), internalNotes: form.get('internalNotes'), active: true, showOnClientReports: form.get('showOnClientReports') === 'on' }) }); setCreating(false); await load() } catch { setError('The team member could not be created.') } finally { setPending(false) }
  }
  return <PrivateShell area="admin" profile={profile} title="Team" eyebrow="Operational collaborators" action={profile.role === 'admin' ? <button className="private-primary" onClick={() => setCreating(!creating)}><Plus />Add team member</button> : undefined}>
    {creating && <section className="private-panel create-panel"><div className="panel-heading"><h2>New collaborator</h2><p>An authentication account is optional and can be linked later.</p></div><form className="admin-form" onSubmit={submit}><label>First name<input name="firstName" required /></label><label>Last name<input name="lastName" required /></label><label>Display name<input name="displayName" required /></label><label>Title<input name="roleTitle" placeholder="Property Inspector" required /></label><label>Email <span>Optional</span><input name="email" type="email" /></label><label>Telephone <span>Optional</span><input name="phone" /></label><label className="full-field">Internal notes <span>Never client-visible</span><textarea name="internalNotes" rows={3} /></label><label className="check-field full-field"><input name="showOnClientReports" type="checkbox" defaultChecked /> Show name and approved photo on client reports</label>{error && <p className="form-error full-field">{error}</p>}<div className="form-actions full-field"><button type="button" className="private-secondary" onClick={() => setCreating(false)}>Cancel</button><button className="private-primary" disabled={pending}>{pending ? 'Creating…' : 'Create collaborator'}</button></div></form></section>}
    {team.length === 0 ? <EmptyState title="No team members yet">Create the first operational collaborator without requiring login credentials.</EmptyState> : <div className="directory-grid">{team.map((member) => <Link to="/admin/team/$id" params={{ id: member.id }} className="team-card" key={member.id}>{member.profile_photo_path ? <div className="team-avatar photo"><PrivateImage bucket="staff-photos" path={member.profile_photo_path} alt={member.display_name} /></div> : <div className="team-avatar"><UserRound /></div>}<div><h2>{member.display_name}</h2><p>{member.role_title}</p><span className={`private-pill ${member.active ? '' : 'muted'}`}>{member.active ? 'Active' : 'Inactive'}</span></div></Link>)}</div>}
  </PrivateShell>
}
