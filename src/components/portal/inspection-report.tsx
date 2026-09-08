import { AlertTriangle, Check, ChevronLeft, ChevronRight, CircleHelp, Clock, Download, Expand, Minus, Play, ShieldAlert, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { downloadPortalFile, portalFile } from '@/lib/portal/api'
import { mediaForArea, type ClientInspectionReport, type InspectionArea, type InspectionMedia, type InspectionResultStatus } from '@/lib/portal/types'
import { PrivateImage } from './private-image'
import { downloadSignedMedia, PrivateVideo } from './private-video'

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

function durationLabel(seconds?: number | null) {
  if (!seconds) return null
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return minutes > 0 ? `${minutes}:${String(remaining).padStart(2, '0')}` : `0:${String(remaining).padStart(2, '0')}`
}

type GalleryMedia = { area: InspectionArea; media: InspectionMedia; itemLabel: string | null }

function MediaLightbox({ report, entries, selectedIndex, onSelect, onClose }: { report: ClientInspectionReport; entries: GalleryMedia[]; selectedIndex: number; onSelect: (index: number) => void; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null)
  const selected = entries[selectedIndex]
  useEffect(() => {
    closeButton.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') onSelect((selectedIndex - 1 + entries.length) % entries.length)
      if (event.key === 'ArrowRight') onSelect((selectedIndex + 1) % entries.length)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, onSelect, entries.length, selectedIndex])

  if (!selected) return null
  const previous = () => onSelect((selectedIndex - 1 + entries.length) % entries.length)
  const next = () => onSelect((selectedIndex + 1) % entries.length)
  const isVideo = selected.media.media_type === 'video'
  const filename = `Guardemar_${selected.area.custom_label.replaceAll(/[^a-zA-Z0-9]+/g, '-')}_${selectedIndex + 1}.${isVideo ? 'mp4' : 'jpg'}`
  return <div className="photo-lightbox" role="dialog" aria-modal="true" aria-labelledby="lightbox-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="lightbox-panel">
      <header>
        <div><p className="private-eyebrow">{selected.area.custom_label}</p><h2 id="lightbox-title">{selected.itemLabel || (isVideo ? 'Inspection video' : 'Inspection photograph')}</h2><p>{isVideo ? 'Video' : 'Photo'} {selectedIndex + 1} of {entries.length}</p></div>
        <button ref={closeButton} className="lightbox-icon" type="button" onClick={onClose} aria-label="Close media"><X /></button>
      </header>
      <div className="lightbox-image">{isVideo
        ? <PrivateVideo path={selected.media.storage_path} posterPath={selected.media.poster_storage_path} caption={selected.media.caption} />
        : <AuthorisedImage path={`${report.id}/media/${selected.media.id}/display`} alt={selected.media.caption || `${selected.area.custom_label} photograph`} />}</div>
      {selected.media.caption && <p className="lightbox-caption">{selected.media.caption}</p>}
      <footer>
        <button className="private-secondary" type="button" onClick={previous} disabled={entries.length < 2}><ChevronLeft />Previous</button>
        <button className="private-secondary" type="button" onClick={() => { void (isVideo ? downloadSignedMedia('inspection-photos', selected.media.storage_path, filename) : downloadPortalFile(`${report.id}/media/${selected.media.id}/download`)) }}><Download />Download</button>
        <button className="private-secondary" type="button" onClick={next} disabled={entries.length < 2}>Next<ChevronRight /></button>
      </footer>
    </div>
  </div>
}

export function InspectionReport({ report, preview = false }: { report: ClientInspectionReport; preview?: boolean }) {
  const media = useMemo(() => report.areas.flatMap((area) => mediaForArea(area).map((item) => ({
    area,
    media: item,
    itemLabel: area.items.find((entry) => entry.id === item.inspection_item_id)?.label ?? null,
  }))), [report.areas])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const mediaIndex = (mediaId: string) => media.findIndex((entry) => entry.media.id === mediaId)

  return <article className="inspection-report">
    {preview && <div className="preview-ribbon">Client preview — unpublished</div>}
    <header className="report-header"><p className="private-eyebrow">GUARDEMAR · Property inspection</p><h2>{report.property.display_name}</h2><p>{report.property.locality} · {new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(report.scheduled_for))}</p><div className="report-overall"><span>Overall condition</span><StatusMark status={report.overall_condition} /></div></header>
    {report.inspector && <section className="report-inspector">{report.inspector.profile_photo_path && !preview && <AuthorisedImage path={`${report.id}/inspector/display`} alt={report.inspector.display_name} />}<div><span>Inspected by</span><strong>{report.inspector.display_name}</strong><small>{report.inspector.role_title}</small></div></section>}
    <div className="report-areas">{report.areas.map((area) => <section className="report-area" key={area.id}><div className="report-area-heading"><div><small>{area.area_type}</small><h3>{area.custom_label}</h3></div><StatusMark status={area.status} /></div>
      <div className="report-items">{area.items.map((item) => <div className="report-item" key={item.id}><div><strong>{item.label}</strong>{item.observation && <p>{item.observation}</p>}{item.recommendation && <p><b>Recommendation:</b> {item.recommendation}</p>}</div><StatusMark status={item.status} /></div>)}</div>
      {(area.observation || area.recommendation) && <div className="report-note">{area.observation && <><strong>Observation</strong><p>{area.observation}</p></>}{area.recommendation && <><strong>Recommendation</strong><p>{area.recommendation}</p></>}</div>}
      {mediaForArea(area).length > 0 && <div className="report-photos">{mediaForArea(area).map((item) => {
        const isVideo = item.media_type === 'video'
        return <figure key={item.id}><button type="button" className="report-photo-button" onClick={() => setSelectedIndex(mediaIndex(item.id))} aria-label={`View ${item.caption || `${area.custom_label} ${isVideo ? 'video' : 'photograph'}`}`}>
          {isVideo
            ? <PrivateVideoThumb posterPath={item.poster_storage_path} duration={item.duration_seconds} />
            : <AuthorisedImage path={`${report.id}/media/${item.id}/thumbnail`} alt={item.caption || area.custom_label} />}
          <span>{isVideo ? <Play /> : <Expand />}{isVideo ? 'Play' : 'View'}</span>
        </button>{item.caption && <figcaption>{item.caption}</figcaption>}<button className="photo-download" type="button" onClick={() => { void (isVideo ? downloadSignedMedia('inspection-photos', item.storage_path, `Guardemar-video-${item.id}.mp4`) : downloadPortalFile(`${report.id}/media/${item.id}/download`)) }}><Download />Download {isVideo ? 'video' : 'photo'}</button></figure>
      })}</div>}
    </section>)}</div>
    {report.client_summary && <footer className="report-summary"><p className="private-eyebrow">Final Guardemar summary</p><p>{report.client_summary}</p><small>Guardemar provides visual property-care inspections. Specialist concerns may require assessment by a qualified third party.</small></footer>}
    {selectedIndex !== null && <MediaLightbox report={report} entries={media} selectedIndex={selectedIndex} onSelect={setSelectedIndex} onClose={() => setSelectedIndex(null)} />}
  </article>
}

// Thumbnail for a video tile in the grid: the poster image if one was
// captured at record time (fetched the same way PrivateImage already fetches
// every other private image: a direct signed Supabase Storage URL, never
// proxied through a Netlify Function), otherwise a plain placeholder with
// the duration -- never the video itself (no autoplay, no downloading a
// video file just to show a thumbnail).
function PrivateVideoThumb({ posterPath, duration }: { posterPath?: string | null; duration?: number | null }) {
  if (!posterPath) return <div className="video-thumb-fallback"><Play />{durationLabel(duration) && <span>{durationLabel(duration)}</span>}</div>
  return <span className="video-thumb"><PrivateImage bucket="inspection-photos" path={posterPath} alt="" /><b><Clock />{durationLabel(duration)}</b></span>
}
