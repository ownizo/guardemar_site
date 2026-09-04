import { createFileRoute } from '@tanstack/react-router'
import { PrivateGuard } from '@/components/portal/auth'
import { PrivateShell } from '@/components/portal/shell'

export const Route = createFileRoute('/portal/account')({ component: Account })

function Account() {
  return <PrivateGuard roles={['customer', 'staff', 'admin']} loginPath="/portal/login">{(profile) => <PrivateShell area="portal" profile={profile} title="Account" eyebrow="Personal details"><div className="private-panel"><dl className="details-list"><div><dt>Name</dt><dd>{[profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Not provided'}</dd></div><div><dt>Telephone</dt><dd>{profile.phone || 'Not provided'}</dd></div><div><dt>Access level</dt><dd>{profile.role}</dd></div></dl><p className="muted-copy">Contact Guardemar to update account ownership or property access permissions.</p></div></PrivateShell>}</PrivateGuard>
}
