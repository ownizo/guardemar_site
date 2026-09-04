import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Building2, ClipboardCheck, Users } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { PrivateShell } from '@/components/portal/shell'
import { portalApi } from '@/lib/portal/api'
import type { PortalProfile } from '@/lib/portal/types'

export const Route = createFileRoute('/admin/')({ head: () => ({ meta: [{ title: 'Operations | GUARDEMAR' }, { name: 'robots', content: 'noindex, nofollow' }] }), component: AdminDashboard })

function AdminDashboard() {
  return <PrivateGuard roles={['staff', 'admin']} loginPath="/admin/login">{(profile) => <Dashboard profile={profile} />}</PrivateGuard>
}

function Dashboard({ profile }: { profile: PortalProfile }) {
  const [counts, setCounts] = useState({ clients: 0, properties: 0 })
  useEffect(() => { void portalApi<{ counts: typeof counts }>('admin/dashboard').then((data) => setCounts(data.counts)) }, [])
  const today = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Lisbon' }).format(new Date())
  return <PrivateShell area="admin" profile={profile} title="Operations dashboard" eyebrow={today}>
    <div className="operations-summary"><Link to="/admin/clients"><Users /><span><strong>{counts.clients}</strong>Active clients</span><ArrowRight /></Link><Link to="/admin/properties"><Building2 /><span><strong>{counts.properties}</strong>Active properties</span><ArrowRight /></Link><div><ClipboardCheck /><span><strong>0</strong>Inspections today</span></div></div>
    <div className="operations-grid"><section className="private-panel"><div className="panel-heading"><h2>Today’s inspections</h2></div><p className="panel-empty">No inspections are scheduled for today.</p></section><section className="private-panel"><div className="panel-heading"><h2>Open property issues</h2></div><p className="panel-empty">No urgent property issues.</p></section><section className="private-panel"><div className="panel-heading"><h2>Draft inspections</h2></div><p className="panel-empty">No draft inspections.</p></section><section className="private-panel"><div className="panel-heading"><h2>Recent activity</h2></div><p className="panel-empty">Operational activity appears here as records are created.</p></section></div>
  </PrivateShell>
}
