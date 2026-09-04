import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeft, Printer } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { InspectionReport } from '@/components/portal/inspection-report'
import { PrivateShell } from '@/components/portal/shell'
import { portalApi } from '@/lib/portal/api'
import type { ClientInspectionReport, PortalProfile } from '@/lib/portal/types'

export const Route = createFileRoute('/portal/inspections/$id')({ component: InspectionReportRoute })
function InspectionReportRoute() { return <PrivateGuard area="portal">{(profile) => <Report profile={profile} />}</PrivateGuard> }
function Report({ profile }: { profile: PortalProfile }) {
  const { id } = Route.useParams(); const [report, setReport] = useState<ClientInspectionReport | null>(null)
  useEffect(() => { void portalApi<{ inspection: ClientInspectionReport }>(`inspections/${id}`).then((data) => setReport(data.inspection)) }, [id])
  return <PrivateShell area="portal" profile={profile} title={report?.property.display_name || 'Inspection report'} eyebrow="Published Guardemar report" action={<div className="heading-actions"><Link className="private-secondary" to="/portal/inspections"><ChevronLeft />Inspections</Link><button className="private-secondary" onClick={() => window.print()}><Printer />Print</button></div>}>{report ? <InspectionReport report={report} /> : <div className="private-panel">Loading published report…</div>}</PrivateShell>
}
