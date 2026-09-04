import { AlertTriangle, Check, ChevronLeft, ChevronRight, CircleHelp, Download, Expand, Minus, ShieldAlert, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { downloadPortalFile, portalFile } from '@/lib/portal/api'
import type { ClientInspectionReport, InspectionArea, InspectionPhoto, InspectionResultStatus } from '@/lib/portal/types'

export function statusLabel(status: string) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function StatusMark({ status }: { status: InspectionResultStatus | 'good' | 'attention' | 'urgent' }) {
  const Icon = status === 'good' ? Check : status === 'attention' ? AlertTriangle : status === 'urgent' ? ShieldAlert : status === 'not_applicable' ? Minus : CircleHelp
  return <span className={`inspection-status status-${status}`}><Icon aria-hidden="true" />{statusLabel(status)}</span>
}

function AuthorisedImage({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let active = true
    let objectUrl = ''
    void portalFile(path).then((response) => response.blob()).then((blob) => {
      objectUrl = URL.createObjectURL(blob)
      if (active) setSrc(objectUrl)
    }).catch(() => undefined)
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [path])
  return src ? <img className={className} src={src} alt={alt} loading="lazy" /> : <div className={`photo-placeholder ${className ?? ''}`} aria-label="Loading private photograph" />
}

type GalleryPhoto = { area: InspectionArea; photo: InspectionPhoto; itemLabel: string | null }

function PhotoLightbox({ report, photos, selectedIndex, onSelect, onClose }: { report: ClientInspectionReport; photos: GalleryPhoto[]; selectedIndex: number; onSelect: (index: number) => void; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null)
  const selected = photos[selectedIndex]
  useEffect(() => {
    closeButton.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') onSelect((selectedIndex - 1 + photos.length) % photos.length)
      if (event.key === 'ArrowRight') onSelect((selectedIndex + 1) % photos.length)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, onSelect, photos.length, selectedIndex])

  if (!selected) return null
  const previous = () => onSelect((selectedIndex - 1 + photos.length) % photos.length)
  const next = () => onSelect((selectedIndex + 1) % photos.length)
  return <div className="photo-lightbox" role="dialog" aria-modal="true" aria-labelledby="lightbox-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="lightbox-panel">
      <header>
        <div><p className="private-eyebrow">{selected.area.custom_label}</p><h2 id="lightbox-title">{selected.itemLabel || 'Inspection photograph'}</h2><p>Photo {selectedIndex + 1} of {photos.length}</p></div>
        <button ref={closeButton} className="lightbox-icon" type="button" onClick={onClose} aria-label="Close photograph"><X /></button>
      </header>
      <div className="lightbox-image"><AuthorisedImage path={`${report.id}/photos/${selected.photo.id}/display`} alt={selected.photo.caption || `${selected.area.custom_label} inspection photograph`} /></div>
      {selected.photo.caption && <p className="lightbox-caption">{selected.photo.caption}</p>}
      <footer>
        <button className="private-secondary" type="button" onClick={previous} disabled={photos.length < 2}><ChevronLeft />Previous</button>
        <button className="private-secondary" type="button" onClick={() => void downloadPortalFile(`${report.id}/photos/${selected.photo.id}/download`)}><Download />Download</button>
        <button className="private-secondary" type="button" onClick={next} disabled={photos.length < 2}>Next<ChevronRight /></button>
      </footer>
    </div>
  </div>
}

export function InspectionReport({ report, preview = false }: { report: ClientInspectionReport; preview?: boolean }) {
  const photos = useMemo(() => report.areas.flatMap((area) => area.photos.map((photo) => ({
    area,
    photo,
    itemLabel: area.items.find((item) => item.id === photo.inspection_item_id)?.label ?? null,
  }))), [report.areas])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const photoIndex = (photoId: string) => photos.findIndex((entry) => entry.photo.id === photoId)

  return <article className="inspection-report">
    {preview && <div className="preview-ribbon">Client preview — unpublished</div>}
    <header className="report-header"><p className="private-eyebrow">GUARDEMAR · Property inspection</p><h2>{report.property.display_name}</h2><p>{report.property.locality} · {new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(report.scheduled_for))}</p><div className="report-overall"><span>Overall condition</span><StatusMark status={report.overall_condition} /></div></header>
    {report.inspector && <section className="report-inspector">{report.inspector.profile_photo_path && !preview && <AuthorisedImage path={`${report.id}/inspector/display`} alt={report.inspector.display_name} />}<div><span>Inspected by</span><strong>{report.inspector.display_name}</strong><small>{report.inspector.role_title}</small></div></section>}
    <div className="report-areas">{report.areas.map((area) => <section className="report-area" key={area.id}><div className="report-area-heading"><div><small>{area.area_type}</small><h3>{area.custom_label}</h3></div><StatusMark status={area.status} /></div>
      <div className="report-items">{area.items.map((item) => <div className="report-item" key={item.id}><div><strong>{item.label}</strong>{item.observation && <p>{item.observation}</p>}{item.recommendation && <p><b>Recommendation:</b> {item.recommendation}</p>}</div><StatusMark status={item.status} /></div>)}</div>
      {(area.observation || area.recommendation) && <div className="report-note">{area.observation && <><strong>Observation</strong><p>{area.observation}</p></>}{area.recommendation && <><strong>Recommendation</strong><p>{area.recommendation}</p></>}</div>}
      {area.photos.length > 0 && <div className="report-photos">{area.photos.map((photo) => <figure key={photo.id}><button type="button" className="report-photo-button" onClick={() => setSelectedIndex(photoIndex(photo.id))} aria-label={`View ${photo.caption || `${area.custom_label} photograph`}`}><AuthorisedImage path={`${report.id}/photos/${photo.id}/thumbnail`} alt={photo.caption || area.custom_label} /><span><Expand />View</span></button>{photo.caption && <figcaption>{photo.caption}</figcaption>}<button className="photo-download" type="button" onClick={() => void downloadPortalFile(`${report.id}/photos/${photo.id}/download`)}><Download />Download photo</button></figure>)}</div>}
    </section>)}</div>
    {report.client_summary && <footer className="report-summary"><p className="private-eyebrow">Final Guardemar summary</p><p>{report.client_summary}</p><small>Guardemar provides visual property-care inspections. Specialist concerns may require assessment by a qualified third party.</small></footer>}
    {selectedIndex !== null && <PhotoLightbox report={report} photos={photos} selectedIndex={selectedIndex} onSelect={setSelectedIndex} onClose={() => setSelectedIndex(null)} />}
  </article>
}
