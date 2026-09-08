import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeft, Download, Images } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { BaselineReview } from '@/components/portal/baseline-condition'
import { InspectionReport } from '@/components/portal/inspection-report'
import { downloadSignedMedia } from '@/components/portal/private-video'
import { PrivateShell } from '@/components/portal/shell'
import { downloadPortalFile, portalApi } from '@/lib/portal/api'
import { mediaForArea, type ClientInspectionReport, type PortalProfile } from '@/lib/portal/types'

export const Route = createFileRoute('/portal/inspections_/$id')({ component: InspectionReportRoute })
function InspectionReportRoute() { return <PrivateGuard area="portal">{(profile) => <Report profile={profile} />}</PrivateGuard> }
function Report({ profile }: { profile: PortalProfile }) {
  const { id } = Route.useParams(); const [report, setReport] = useState<ClientInspectionReport | null>(null); const [error, setError] = useState('')
  useEffect(() => { void portalApi<{ inspection: ClientInspectionReport }>(`inspections/${id}`).then((data) => setReport(data.inspection)).catch(() => setError('This inspection report is no longer available online.')) }, [id])
  const availableUntil = report ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(report.available_until)) : ''
  const allMedia = report ? report.areas.flatMap((area) => mediaForArea(area)) : []
  const hasImages = allMedia.some((item) => item.media_type !== 'video')
  const videos = allMedia.filter((item) => item.media_type === 'video')

  // "Download all media": the photo ZIP is generated server-side as before;
  // videos are never bundled into that ZIP (see createZip in
  // inspection-files.mts) -- each is instead downloaded directly, one at a
  // time, from its own short-lived signed Supabase Storage URL.
  async function downloadAllMedia() {
    if (hasImages) await downloadPortalFile(`${id}/media/photos-zip`)
    for (const [index, video] of videos.entries()) {
      await downloadSignedMedia('inspection-photos', video.storage_path, `Guardemar-video-${index + 1}.mp4`)
      if (index < videos.length - 1) await new Promise((resolve) => setTimeout(resolve, 400))
    }
  }

  return <PrivateShell area="portal" profile={profile} title={report?.property.display_name || 'Inspection report'} eyebrow="Published Guardemar report" action={<div className="heading-actions"><Link className="private-secondary" to="/portal/inspections"><ChevronLeft />Inspections</Link></div>}>{report ? <>
    <section className="inspection-downloads" aria-labelledby="inspection-actions-title"><div><p className="private-eyebrow">Inspection report</p><h2 id="inspection-actions-title">{new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(report.scheduled_for))}</h2><p><strong>Available in your portal until:</strong> {availableUntil}</p>{report.days_remaining < 30 && <p className="expiry-reminder">This inspection remains available for {report.days_remaining} more {report.days_remaining === 1 ? 'day' : 'days'}.</p>}</div><div className="inspection-action-buttons"><button className="private-primary" type="button" onClick={() => void downloadPortalFile(`${id}/pdf`)}><Download />Download PDF</button>{allMedia.length > 0 && <button className="private-secondary" type="button" onClick={() => void downloadAllMedia()}><Images />Download all media</button>}</div><p className="retention-copy">Reports, photographs and videos are available in your Guardemar portal for 180 days after publication. Please download any files you wish to retain for your records.</p></section>
    <BaselineReview report={report} />
    <InspectionReport report={report} />
  </> : error ? <div className="private-panel expired-report"><h2>Inspection report expired</h2><p>{error}</p><p>Report and photographs are no longer available online.</p><Link className="private-secondary" to="/portal/inspections"><ChevronLeft />Return to inspections</Link></div> : <div className="private-panel">Loading published report…</div>}</PrivateShell>
}
