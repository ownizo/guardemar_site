import { AlertTriangle, Check, CircleHelp, Minus, ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'

import { getPortalSupabase } from '@/lib/portal/supabase'
import type { ClientInspectionReport, InspectionResultStatus } from '@/lib/portal/types'

export function statusLabel(status: string) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function StatusMark({ status }: { status: InspectionResultStatus | 'good' | 'attention' | 'urgent' }) {
  const Icon = status === 'good' ? Check : status === 'attention' ? AlertTriangle : status === 'urgent' ? ShieldAlert : status === 'not_applicable' ? Minus : CircleHelp
  return <span className={`inspection-status status-${status}`}><Icon aria-hidden="true" />{statusLabel(status)}</span>
}

export function PrivateImage({ bucket, path, alt }: { bucket: 'inspection-photos' | 'staff-photos'; path: string; alt: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let active = true
    void getPortalSupabase().then((supabase) => supabase.storage.from(bucket).createSignedUrl(path, 900)).then(({ data }) => { if (active) setSrc(data?.signedUrl ?? '') })
    return () => { active = false }
  }, [bucket, path])
  return src ? <img src={src} alt={alt} loading="lazy" /> : <div className="photo-placeholder" aria-label="Loading private photograph" />
}

export function InspectionReport({ report, preview = false }: { report: ClientInspectionReport; preview?: boolean }) {
  return <article className="inspection-report">
    {preview && <div className="preview-ribbon">Client preview — unpublished</div>}
    <header className="report-header"><p className="private-eyebrow">GUARDEMAR · Property inspection</p><h2>{report.property.display_name}</h2><p>{report.property.locality} · {new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date(report.scheduled_for))}</p><div className="report-overall"><span>Overall condition</span><StatusMark status={report.overall_condition} /></div></header>
    {report.inspector && <section className="report-inspector">{report.inspector.profile_photo_path && <PrivateImage bucket="staff-photos" path={report.inspector.profile_photo_path} alt={report.inspector.display_name} />}<div><span>Inspected by</span><strong>{report.inspector.display_name}</strong><small>{report.inspector.role_title}</small></div></section>}
    <div className="report-areas">{report.areas.map((area) => <section className="report-area" key={area.id}><div className="report-area-heading"><div><small>{area.area_type}</small><h3>{area.custom_label}</h3></div><StatusMark status={area.status === 'not_checked' ? area.suggested_status : area.status} /></div>
      <div className="report-items">{area.items.map((item) => <div className="report-item" key={item.id}><div><strong>{item.label}</strong>{item.observation && <p>{item.observation}</p>}{item.recommendation && <p><b>Recommendation:</b> {item.recommendation}</p>}</div><StatusMark status={item.status} /></div>)}</div>
      {(area.observation || area.recommendation) && <div className="report-note">{area.observation && <><strong>Observation</strong><p>{area.observation}</p></>}{area.recommendation && <><strong>Recommendation</strong><p>{area.recommendation}</p></>}</div>}
      {area.photos.length > 0 && <div className="report-photos">{area.photos.map((photo) => <figure key={photo.id}><PrivateImage bucket="inspection-photos" path={photo.storage_path} alt={photo.caption || area.custom_label} />{photo.caption && <figcaption>{photo.caption}</figcaption>}</figure>)}</div>}
    </section>)}</div>
    {report.client_summary && <footer className="report-summary"><p className="private-eyebrow">Final Guardemar summary</p><p>{report.client_summary}</p><small>Guardemar provides visual property-care inspections. Specialist concerns may require assessment by a qualified third party.</small></footer>}
  </article>
}
