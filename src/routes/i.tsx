import { createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeft, ArrowRight, Camera, Check, ChevronLeft, ChevronRight, CloudOff, Film, LoaderCircle, Play, ShieldCheck, Trash2, Video } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { clampInspectionAreaIndex, inspectionSetupIsComplete } from '@/lib/portal/field-inspection-state'
import { mediaForArea, type InspectionArea, type InspectionItem, type InspectionMedia, type InspectionResultStatus } from '@/lib/portal/types'

type FieldInspection = { id: string; status: string; scheduled_for: string; property_id: string; property_name: string; locality: string; inspector_name: string }
type FieldSession = { inspection: FieldInspection; areas: InspectionArea[]; inspection_setup_complete?: boolean }
type SaveState = 'saved' | 'saving' | 'offline'
type MediaErrorCode = 'MEDIA_AUTHORIZATION_ERROR' | 'MEDIA_UPLOAD_ERROR' | 'MEDIA_REGISTER_ERROR' | 'MEDIA_LIMIT_REACHED' | 'NETWORK_ERROR'
const MAX_MEDIA_PER_AREA = 5
const MAX_VIDEO_SECONDS = 60
const MAX_VIDEO_BYTES = 100 * 1024 * 1024
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

// A queued upload for one file, tracked from selection through to
// registration so a failure on one item never loses another already in
// flight or already uploaded, and so "Retry" works without re-selecting the
// file (see task section 14).
type QueuedMedia = {
  localId: string
  file: File
  areaId: string
  itemId: string | null
  mediaType: 'image' | 'video'
  status: 'uploading' | 'success' | 'error'
  errorCode?: MediaErrorCode
  message?: string
  previewUrl: string
  posterUrl?: string
  durationSeconds?: number
  mediaId?: string
}
type MediaUploadAuthorization = { storagePath: string; signedUrl: string; expiresAt: string }
const statuses: { value: InspectionResultStatus; short: string }[] = [{ value: 'good', short: 'Good' }, { value: 'attention', short: 'Attention' }, { value: 'urgent', short: 'Urgent' }, { value: 'not_applicable', short: 'N/A' }]

export const Route = createFileRoute('/i')({ head: () => ({ meta: [{ title: 'Field Inspection | GUARDEMAR' }, { name: 'robots', content: 'noindex, nofollow' }] }), component: FieldInspectionRoute })

class FieldApiError extends Error {
  constructor(public code: string, message: string) { super(message) }
}

async function fieldApi<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api/inspection/${path}`, { ...init, headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } })
  } catch {
    throw new FieldApiError('NETWORK_ERROR', 'The network connection was interrupted.')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new FieldApiError(data?.error?.code || 'NETWORK_ERROR', data?.error?.message || 'The inspection update failed.')
  return data as T
}

async function prepareImage(file: File) {
  if (file.size <= 1_500_000 || !file.type.match(/^image\/(jpeg|png|webp)$/)) return file
  const bitmap = await createImageBitmap(file); const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height)); const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale); const context = canvas.getContext('2d'); if (!context) return file; context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', .82)); return blob ? new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' }) : file
}

// Reads a video's duration and captures a frame as a poster thumbnail,
// entirely client-side (no server video-processing pipeline exists). The
// duration read here is what gets persisted -- see the migration's
// duration_seconds comment: it is a UX/record-keeping value, not a security
// control. The real backstop against runaway uploads is the file-size cap.
async function inspectVideo(file: File): Promise<{ durationSeconds: number; poster: Blob | null }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    const url = URL.createObjectURL(file)
    video.src = url
    video.onloadedmetadata = () => { video.currentTime = Math.min(0.5, video.duration / 2) }
    video.onseeked = () => {
      let poster: Blob | null = null
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const context = canvas.getContext('2d')
        if (context && canvas.width > 0) context.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => {
          poster = blob
          URL.revokeObjectURL(url)
          resolve({ durationSeconds: Math.round(video.duration) || 0, poster })
        }, 'image/jpeg', 0.75)
      } catch {
        URL.revokeObjectURL(url)
        resolve({ durationSeconds: Math.round(video.duration) || 0, poster: null })
      }
    }
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This video could not be read.')) }
  })
}

function mediaErrorMessage(code: MediaErrorCode) {
  if (code === 'MEDIA_AUTHORIZATION_ERROR') return 'Upload could not be authorised. Tap Retry.'
  if (code === 'MEDIA_REGISTER_ERROR') return 'The file could not be attached to the inspection. Tap Retry; it is still on your device.'
  if (code === 'MEDIA_LIMIT_REACHED') return 'This area already has 5 media items. Remove one to add another.'
  if (code === 'NETWORK_ERROR') return 'The connection was interrupted. Tap Retry; it is still on your device.'
  return 'Upload failed. Tap Retry; it is still on your device.'
}

function durationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${minutes}:${String(remaining).padStart(2, '0')}`
}

// One "+ Add media" control cluster: three distinct affordances so mobile
// browsers offer the right native picker (camera photo, camera video
// recording, or the photo/video library), without making desktop upload
// unusable (the third input has no `capture` attribute, so on desktop it is
// simply a normal file chooser).
function AddMediaButtons({ disabled, onFiles }: { disabled: boolean; onFiles: (files: File[]) => void }) {
  return <div className="add-media-cluster">
    <label className={`field-photo-button${disabled ? ' disabled' : ''}`}><Camera />Take photo<input type="file" accept="image/*" capture="environment" disabled={disabled} onChange={(event) => { const files = [...(event.target.files ?? [])]; event.currentTarget.value = ''; if (files.length) onFiles(files) }} /></label>
    <label className={`field-photo-button${disabled ? ' disabled' : ''}`}><Video />Record video<input type="file" accept="video/*" capture="environment" disabled={disabled} onChange={(event) => { const files = [...(event.target.files ?? [])]; event.currentTarget.value = ''; if (files.length) onFiles(files) }} /></label>
    <label className={`field-photo-button${disabled ? ' disabled' : ''}`}><Film />Choose from library<input type="file" accept="image/*,video/*" multiple disabled={disabled} onChange={(event) => { const files = [...(event.target.files ?? [])]; event.currentTarget.value = ''; if (files.length) onFiles(files) }} /></label>
  </div>
}

// Combined media grid for one area: existing (already-registered) media plus
// any items currently uploading/failed in this browser session. Existing
// items uploaded in an earlier session render a plain type/duration tile --
// their real thumbnail isn't fetched here (the field link is a bearer
// token, not a Supabase session, so it can't request a signed Storage URL
// the way the authenticated portal does); items just captured in this
// session use the local preview the browser already has in memory.
function MediaGrid({ area, queue, localPreviews, count, onRemove, onMove, onRetry, onDismiss }: {
  area: InspectionArea
  queue: QueuedMedia[]
  localPreviews: Map<string, { previewUrl: string; posterUrl?: string }>
  count: number
  onRemove: (mediaId: string) => void
  onMove: (mediaId: string, offset: number) => void
  onRetry: (localId: string) => void
  onDismiss: (localId: string) => void
}) {
  const existing = mediaForArea(area)
  const pending = queue.filter((item) => item.areaId === area.id)
  if (existing.length === 0 && pending.length === 0) return null
  return <div className="field-media-grid">
    <p className="field-media-count">{count} of {MAX_MEDIA_PER_AREA} media items</p>
    <div className="field-media-tiles">
      {existing.map((item, index) => <MediaTile key={item.id} item={item} preview={localPreviews.get(item.id)} first={index === 0} last={index === existing.length - 1} onRemove={() => onRemove(item.id)} onMoveLeft={() => onMove(item.id, -1)} onMoveRight={() => onMove(item.id, 1)} />)}
      {pending.map((item) => <PendingTile key={item.localId} item={item} onRetry={() => onRetry(item.localId)} onDismiss={() => onDismiss(item.localId)} />)}
    </div>
  </div>
}

function MediaTile({ item, preview, first, last, onRemove, onMoveLeft, onMoveRight }: { item: InspectionMedia; preview?: { previewUrl: string; posterUrl?: string }; first: boolean; last: boolean; onRemove: () => void; onMoveLeft: () => void; onMoveRight: () => void }) {
  const isVideo = item.media_type === 'video'
  const thumbSrc = isVideo ? preview?.posterUrl : preview?.previewUrl
  return <article className="field-media-tile">
    <div className="field-media-thumb">
      {thumbSrc ? <img src={thumbSrc} alt="" /> : <div className="field-media-placeholder">{isVideo ? <Play /> : <Camera />}</div>}
      {isVideo && item.duration_seconds ? <span className="field-media-duration"><Play />{durationLabel(item.duration_seconds)}</span> : null}
    </div>
    <div className="field-media-actions">
      <button type="button" onClick={onMoveLeft} disabled={first} aria-label="Move earlier"><ArrowLeft /></button>
      <button type="button" onClick={onMoveRight} disabled={last} aria-label="Move later"><ArrowRight /></button>
      <button type="button" className="field-media-remove" onClick={onRemove} aria-label="Remove"><Trash2 /></button>
    </div>
  </article>
}

function PendingTile({ item, onRetry, onDismiss }: { item: QueuedMedia; onRetry: () => void; onDismiss: () => void }) {
  const thumbSrc = item.posterUrl || item.previewUrl
  return <article className={`field-media-tile pending ${item.status}`}>
    <div className="field-media-thumb">
      {thumbSrc ? <img src={thumbSrc} alt="" /> : <div className="field-media-placeholder">{item.mediaType === 'video' ? <Play /> : <Camera />}</div>}
      {item.status === 'uploading' && <div className="field-media-overlay"><LoaderCircle className="spin" /></div>}
      {item.status === 'error' && <div className="field-media-overlay error"><AlertTriangle /></div>}
      {item.status === 'success' && <div className="field-media-overlay success"><Check /></div>}
    </div>
    {item.status === 'uploading' && <p className="field-media-status">Uploading…</p>}
    {item.status === 'success' && <p className="field-media-status">Uploaded</p>}
    {item.status === 'error' && <div className="field-media-status error"><span>{item.message}</span><div><button type="button" onClick={onRetry}>Retry</button><button type="button" onClick={onDismiss}>Remove</button></div></div>}
  </article>
}

function FieldInspectionRoute() {
  const [token, setToken] = useState(''); const [session, setSession] = useState<FieldSession | null>(null); const [areaIndex, setAreaIndex] = useState(0); const [saveState, setSaveState] = useState<SaveState>('saved'); const [error, setError] = useState(''); const [queue, setQueue] = useState<QueuedMedia[]>([]); const [completed, setCompleted] = useState(false)
  const revisions = useRef(new Map<string, number>()); const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>()); const pendingPatches = useRef(new Map<string, { path: string; patch: Record<string, unknown>; revision: number }>())
  const localPreviews = useRef(new Map<string, { previewUrl: string; posterUrl?: string }>())
  useEffect(() => { const hashToken = window.location.hash.slice(1); const savedToken = sessionStorage.getItem('guardemar:inspection-token') || ''; const next = hashToken || savedToken; if (hashToken) { sessionStorage.setItem('guardemar:inspection-token', hashToken); history.replaceState(null, '', '/i') } setToken(next) }, [])
  useEffect(() => { if (!token) return; void fieldApi<FieldSession>(token, 'session').then((data) => { const draft = sessionStorage.getItem(`guardemar:inspection-draft:${data.inspection.id}`); if (!draft) { setSession(data); return } try { const draftAreas = JSON.parse(draft) as unknown; setSession(Array.isArray(draftAreas) && draftAreas.length === data.areas.length ? { ...data, areas: draftAreas as InspectionArea[] } : data) } catch { setSession(data) } }).catch((reason) => setError(reason instanceof Error ? reason.message : 'This inspection link is unavailable.')) }, [token])
  useEffect(() => { if (session) sessionStorage.setItem(`guardemar:inspection-draft:${session.inspection.id}`, JSON.stringify(session.areas)) }, [session])
  useEffect(() => { if (!token) return; const retry = () => { for (const key of pendingPatches.current.keys()) void persistPatch(key) }; window.addEventListener('online', retry); return () => window.removeEventListener('online', retry) }, [token])
  useEffect(() => { if (!session) return; const safeIndex = clampInspectionAreaIndex(areaIndex, session.areas.length); if (safeIndex !== areaIndex) setAreaIndex(safeIndex) }, [areaIndex, session])

  const progress = useMemo(() => { const items = session?.areas.flatMap((area) => area.items) ?? []; return { answered: items.filter((item) => item.status !== 'not_checked').length, total: items.length, areas: session?.areas.filter((area) => area.items.every((item) => !item.required || item.status !== 'not_checked')).length ?? 0 } }, [session])
  function updateItem(areaId: string, itemId: string, patch: Partial<InspectionItem>) { setSession((current) => current ? { ...current, areas: current.areas.map((area) => area.id === areaId ? { ...area, items: area.items.map((item) => item.id === itemId ? { ...item, ...patch } : item) } : area) } : current); scheduleSave(`item:${itemId}`, `items/${itemId}`, patch) }
  function updateArea(areaId: string, patch: Partial<InspectionArea>) { setSession((current) => current ? { ...current, areas: current.areas.map((area) => area.id === areaId ? { ...area, ...patch } : area) } : current); scheduleSave(`area:${areaId}`, `areas/${areaId}`, patch) }
  function scheduleSave(key: string, path: string, patch: object) { if (!token) return; const revision = (revisions.current.get(key) ?? 0) + 1; revisions.current.set(key, revision); const existing = pendingPatches.current.get(key); pendingPatches.current.set(key, { path, patch: { ...(existing?.patch ?? {}), ...patch }, revision }); const previous = timers.current.get(key); if (previous) clearTimeout(previous); setSaveState('saving'); timers.current.set(key, setTimeout(() => { void persistPatch(key) }, 550)) }
  async function persistPatch(key: string) { const pending = pendingPatches.current.get(key); if (!pending || !token) return; setSaveState('saving'); try { await fieldApi(token, pending.path, { method: 'PATCH', body: JSON.stringify(pending.patch) }); const current = pendingPatches.current.get(key); if (current?.revision === pending.revision) pendingPatches.current.delete(key); setSaveState(pendingPatches.current.size === 0 ? 'saved' : 'saving') } catch { setSaveState('offline') } }

  function mediaCount(areaId: string) {
    const area = session?.areas.find((entry) => entry.id === areaId)
    const existing = area ? mediaForArea(area).length : 0
    const inFlight = queue.filter((item) => item.areaId === areaId && item.status !== 'error').length
    return existing + inFlight
  }

  async function reportUploadFailure(item: QueuedMedia, storagePath: string, code: 'MEDIA_UPLOAD_ERROR' | 'NETWORK_ERROR', status?: number, storageCode?: string) {
    try { await fieldApi(token, 'media-upload-events', { method: 'POST', body: JSON.stringify({ inspectionId: session?.inspection.id, inspectionAreaId: item.areaId, inspectionItemId: item.itemId, storagePath, code, status, storageCode }) }) } catch {}
  }

  async function refreshSession() {
    try { const refreshed = await fieldApi<FieldSession>(token, 'session'); setSession(refreshed) } catch { setError('Uploaded. Refresh the inspection to display it.') }
  }

  async function performUpload(item: QueuedMedia) {
    if (!session) return
    setQueue((current) => current.map((entry) => entry.localId === item.localId ? { ...entry, status: 'uploading', errorCode: undefined, message: undefined } : entry))
    try {
      const contentType = item.file.type
      const authorization = await fieldApi<MediaUploadAuthorization>(token, 'media-upload-url', { method: 'POST', body: JSON.stringify({ inspectionId: session.inspection.id, inspectionAreaId: item.areaId, inspectionItemId: item.itemId, filename: item.file.name, contentType, purpose: 'media' }) })
      await putSigned(authorization.signedUrl, item.file, item, authorization.storagePath)

      let posterStoragePath: string | undefined
      if (item.mediaType === 'video' && item.posterUrl) {
        const posterBlob = await fetch(item.posterUrl).then((response) => response.blob())
        const posterAuthorization = await fieldApi<MediaUploadAuthorization>(token, 'media-upload-url', { method: 'POST', body: JSON.stringify({ inspectionId: session.inspection.id, inspectionAreaId: item.areaId, inspectionItemId: item.itemId, filename: 'poster.jpg', contentType: 'image/jpeg', purpose: 'poster' }) })
        await putSigned(posterAuthorization.signedUrl, new File([posterBlob], 'poster.jpg', { type: 'image/jpeg' }), item, posterAuthorization.storagePath)
        posterStoragePath = posterAuthorization.storagePath
      }

      const registered = await fieldApi<{ media: { id: string } }>(token, 'media', {
        method: 'POST',
        body: JSON.stringify({
          inspectionId: session.inspection.id, inspectionAreaId: item.areaId, inspectionItemId: item.itemId,
          storagePath: authorization.storagePath, mediaType: item.mediaType,
          originalFilename: item.file.name, displayOrder: mediaForArea(session.areas.find((area) => area.id === item.areaId)!).length,
          ...(item.mediaType === 'video' ? { durationSeconds: Math.min(item.durationSeconds ?? MAX_VIDEO_SECONDS, MAX_VIDEO_SECONDS), posterStoragePath } : {}),
        }),
      })
      localPreviews.current.set(registered.media.id, { previewUrl: item.previewUrl, posterUrl: item.posterUrl })
      setQueue((current) => current.map((entry) => entry.localId === item.localId ? { ...entry, status: 'success', mediaId: registered.media.id } : entry))
      await refreshSession()
      setQueue((current) => current.filter((entry) => entry.localId !== item.localId))
    } catch (reason) {
      const code = reason instanceof FieldApiError && ['MEDIA_AUTHORIZATION_ERROR', 'MEDIA_UPLOAD_ERROR', 'MEDIA_REGISTER_ERROR', 'MEDIA_LIMIT_REACHED', 'NETWORK_ERROR'].includes(reason.code) ? reason.code as MediaErrorCode : 'NETWORK_ERROR'
      setQueue((current) => current.map((entry) => entry.localId === item.localId ? { ...entry, status: 'error', errorCode: code, message: mediaErrorMessage(code) } : entry))
    }

    async function putSigned(signedUrl: string, file: File, uploadItem: QueuedMedia, storagePath: string) {
      const form = new FormData(); form.append('cacheControl', '3600'); form.append('', file, file.name)
      let response: Response
      try { response = await fetch(signedUrl, { method: 'PUT', headers: { 'x-upsert': 'false' }, body: form }) } catch { await reportUploadFailure(uploadItem, storagePath, 'NETWORK_ERROR'); throw new FieldApiError('NETWORK_ERROR', 'The network connection was interrupted.') }
      if (!response.ok) {
        const storageError = await response.json().catch(() => ({})) as { code?: string; statusCode?: string }
        await reportUploadFailure(uploadItem, storagePath, 'MEDIA_UPLOAD_ERROR', response.status, storageError.code || storageError.statusCode)
        throw new FieldApiError('MEDIA_UPLOAD_ERROR', 'The file could not be uploaded.')
      }
    }
  }

  async function addFiles(files: File[], areaId: string, itemId: string | null) {
    setError('')
    const currentCount = mediaCount(areaId)
    const room = MAX_MEDIA_PER_AREA - currentCount
    if (room <= 0) { setError(`This area already has ${MAX_MEDIA_PER_AREA} media items. Remove one to add another.`); return }
    const accepted = files.slice(0, room)
    if (files.length > accepted.length) setError(`Only ${room} more media item${room === 1 ? '' : 's'} can be added to this area (5 maximum). ${files.length - accepted.length} file${files.length - accepted.length === 1 ? '' : 's'} skipped.`)

    for (const file of accepted) {
      const isImage = file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/')
      if (!isImage && !isVideo) { setError(`${file.name}: unsupported file type.`); continue }
      if (isImage && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MAX_IMAGE_BYTES)) { setError(`${file.name}: use a JPEG, PNG or WebP image under 10 MB.`); continue }
      if (isVideo && !['video/mp4', 'video/quicktime', 'video/webm'].includes(file.type)) { setError(`${file.name}: use an MP4, MOV or WebM video.`); continue }
      if (isVideo && file.size > MAX_VIDEO_BYTES) { setError(`${file.name}: video must be under 100 MB.`); continue }

      const localId = crypto.randomUUID()
      if (isImage) {
        const prepared = await prepareImage(file).catch(() => file)
        const previewUrl = URL.createObjectURL(prepared)
        const queued: QueuedMedia = { localId, file: prepared, areaId, itemId, mediaType: 'image', status: 'uploading', previewUrl }
        setQueue((current) => [...current, queued])
        void performUpload(queued)
        continue
      }

      try {
        const { durationSeconds, poster } = await inspectVideo(file)
        if (durationSeconds > MAX_VIDEO_SECONDS) { setError(`${file.name}: video is ${durationLabel(durationSeconds)}, the limit is ${MAX_VIDEO_SECONDS} seconds.`); continue }
        const previewUrl = poster ? URL.createObjectURL(poster) : ''
        const queued: QueuedMedia = { localId, file, areaId, itemId, mediaType: 'video', status: 'uploading', previewUrl, posterUrl: previewUrl || undefined, durationSeconds }
        setQueue((current) => [...current, queued])
        void performUpload(queued)
      } catch {
        setError(`${file.name}: this video could not be read.`)
      }
    }
  }

  function retryUpload(localId: string) {
    const item = queue.find((entry) => entry.localId === localId)
    if (item) void performUpload(item)
  }
  function dismissUpload(localId: string) { setQueue((current) => current.filter((entry) => entry.localId !== localId)) }

  async function removeMedia(mediaId: string) {
    try { await fieldApi(token, `media/${mediaId}`, { method: 'PATCH', body: JSON.stringify({ rejected: true }) }); await refreshSession() } catch { setError('The media item could not be removed.') }
  }
  async function moveMedia(area: InspectionArea, mediaId: string, offset: number) {
    const items = mediaForArea(area)
    const index = items.findIndex((entry) => entry.id === mediaId)
    const target = index + offset
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    try { await fieldApi(token, `areas/${area.id}/media-reorder`, { method: 'POST', body: JSON.stringify({ orderedIds: next.map((entry) => entry.id) }) }); await refreshSession() } catch { setError('The media order could not be saved.') }
  }

  async function finish() { if (!session || saveState === 'saving') return; if (queue.some((item) => item.status === 'uploading')) { setError('Please wait for media uploads to finish before completing the inspection.'); return }; const unanswered = session.areas.flatMap((area) => area.items).filter((item) => item.required && item.status === 'not_checked').length; const urgent = session.areas.flatMap((area) => area.items).filter((item) => item.status === 'urgent').length; const attention = session.areas.flatMap((area) => area.items).filter((item) => item.status === 'attention').length; if (!window.confirm(`Complete field inspection?\n\n${progress.areas}/${session.areas.length} areas complete\n${unanswered} required items unanswered\n${attention} attention items\n${urgent} urgent items\n\nThe client will not see this until Guardemar reviews and publishes it.`)) return; try { await fieldApi(token, 'complete', { method: 'POST', body: JSON.stringify({ allowIncomplete: unanswered > 0 }) }); sessionStorage.removeItem(`guardemar:inspection-draft:${session.inspection.id}`); sessionStorage.removeItem('guardemar:inspection-token'); setCompleted(true) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Completion failed.') } }
  if (!token) return <main className="field-error"><ShieldCheck /><h1>Inspection link required</h1><p>Open the secure Guardemar link supplied for this visit.</p></main>
  if (error && !session) return <main className="field-error"><AlertTriangle /><h1>Inspection unavailable</h1><p>{error}</p></main>
  if (!session) return <main className="field-loading"><LoaderCircle className="spin" /><p>Opening secure inspection…</p></main>
  if (completed) return <main className="field-error success"><Check /><h1>Field inspection completed</h1><p>The visit is awaiting Guardemar’s internal review. Nothing has been shared with the client yet.</p></main>
  if (!inspectionSetupIsComplete(session.areas.length, session.inspection_setup_complete)) return <main className="field-error setup-incomplete"><AlertTriangle /><p className="field-error-eyebrow">{session.inspection.property_name} · {session.inspection.locality}</p><h1>Inspection setup incomplete</h1><p>This inspection does not contain any configured inspection areas. Please contact Guardemar before starting the visit.</p><dl><div><dt>Inspector</dt><dd>{session.inspection.inspector_name}</dd></div><div><dt>Visit</dt><dd>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date(session.inspection.scheduled_for))}</dd></div></dl></main>
  const safeAreaIndex = clampInspectionAreaIndex(areaIndex, session.areas.length)
  const area = session.areas[safeAreaIndex]
  if (!area) return <main className="field-error setup-incomplete"><AlertTriangle /><h1>Inspection setup incomplete</h1><p>This inspection does not contain any configured inspection areas. Please contact Guardemar before starting the visit.</p></main>
  const areaAtLimit = mediaCount(area.id) >= MAX_MEDIA_PER_AREA
  return <main className="field-app"><header className="field-header"><div><strong>GUARDEMAR</strong><span>{session.inspection.property_name} · {session.inspection.locality}</span></div><div className={`save-indicator ${saveState}`}>{saveState === 'saving' ? <LoaderCircle className="spin" /> : saveState === 'offline' ? <CloudOff /> : <Check />}{saveState === 'saving' ? 'Saving…' : saveState === 'offline' ? 'Connection problem' : 'Saved'}</div><dl><div><dt>Inspection</dt><dd>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date(session.inspection.scheduled_for))}</dd></div><div><dt>Inspector</dt><dd>{session.inspection.inspector_name}</dd></div></dl><div className="field-progress"><span>Areas {progress.areas} / {session.areas.length}</span><span>Checklist {progress.answered} / {progress.total}</span><progress value={progress.answered} max={progress.total || 1} /></div></header>
    <nav className="field-area-nav" aria-label="Inspection areas">{session.areas.map((entry, index) => <button className={index === safeAreaIndex ? 'active' : ''} onClick={() => setAreaIndex(index)} key={entry.id}><span>{index + 1}</span>{entry.custom_label}</button>)}</nav>
    <section className="field-area"><div className="field-area-title"><div><p>{area.area_type} · Area {safeAreaIndex + 1} of {session.areas.length}</p><h1>{area.custom_label}</h1></div></div><div className="field-items">{area.items.map((item) => <article className="field-item" key={item.id}><div className="field-item-title"><h2>{item.label}</h2>{item.guidance && <p>{item.guidance}</p>}</div><div className="field-statuses">{statuses.map((status) => <button className={item.status === status.value ? `selected ${status.value}` : ''} onClick={() => updateItem(area.id, item.id, { status: status.value })} key={status.value}>{status.short}</button>)}</div><details><summary>Add observation or recommendation</summary><label>Observation<textarea value={item.observation ?? ''} onChange={(event) => updateItem(area.id, item.id, { observation: event.target.value })} rows={2} /></label><label>Recommendation<textarea value={item.recommendation ?? ''} onChange={(event) => updateItem(area.id, item.id, { recommendation: event.target.value })} rows={2} /></label></details><AddMediaButtons disabled={areaAtLimit} onFiles={(files) => { void addFiles(files, area.id, item.id) }} /></article>)}</div><div className="field-area-notes"><label>Area observation<textarea value={area.observation ?? ''} onChange={(event) => updateArea(area.id, { observation: event.target.value })} rows={3} /></label><label>Area recommendation<textarea value={area.recommendation ?? ''} onChange={(event) => updateArea(area.id, { recommendation: event.target.value })} rows={3} /></label><AddMediaButtons disabled={areaAtLimit} onFiles={(files) => { void addFiles(files, area.id, null) }} /></div>
    <MediaGrid area={area} queue={queue} localPreviews={localPreviews.current} count={mediaCount(area.id)} onRemove={(mediaId) => { void removeMedia(mediaId) }} onMove={(mediaId, offset) => { void moveMedia(area, mediaId, offset) }} onRetry={retryUpload} onDismiss={dismissUpload} />
    {error && <p className="field-warning">{error}</p>}<div className="field-footer"><button className="field-previous" disabled={safeAreaIndex === 0} onClick={() => setAreaIndex((value) => value - 1)}><ChevronLeft />Previous</button>{safeAreaIndex < session.areas.length - 1 ? <button className="field-next" onClick={() => setAreaIndex((value) => value + 1)}>Next area<ChevronRight /></button> : <button className="field-complete" disabled={saveState === 'saving' || queue.some((item) => item.status === 'uploading')} onClick={() => { void finish() }}>Complete inspection<Check /></button>}</div></section>
  </main>
}
