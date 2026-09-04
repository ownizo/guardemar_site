import { createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, Camera, Check, ChevronLeft, ChevronRight, CloudOff, LoaderCircle, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { clampInspectionAreaIndex, inspectionSetupIsComplete } from '@/lib/portal/field-inspection-state'
import type { InspectionArea, InspectionItem, InspectionResultStatus } from '@/lib/portal/types'

type FieldInspection = { id: string; status: string; scheduled_for: string; property_id: string; property_name: string; locality: string; inspector_name: string }
type FieldSession = { inspection: FieldInspection; areas: InspectionArea[]; inspection_setup_complete?: boolean }
type SaveState = 'saved' | 'saving' | 'offline'
type PhotoErrorCode = 'PHOTO_AUTHORIZATION_ERROR' | 'PHOTO_UPLOAD_ERROR' | 'PHOTO_REGISTER_ERROR' | 'NETWORK_ERROR'
type PhotoUploadState = { file: File; areaId: string; itemId: string | null; status: 'uploading' | 'success' | 'error'; errorCode?: PhotoErrorCode; message?: string }
type PhotoUploadAuthorization = { storagePath: string; signedUrl: string; expiresAt: string }
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

function FieldInspectionRoute() {
  const [token, setToken] = useState(''); const [session, setSession] = useState<FieldSession | null>(null); const [areaIndex, setAreaIndex] = useState(0); const [saveState, setSaveState] = useState<SaveState>('saved'); const [error, setError] = useState(''); const [photoUpload, setPhotoUpload] = useState<PhotoUploadState | null>(null); const [completed, setCompleted] = useState(false); const revisions = useRef(new Map<string, number>()); const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>()); const pendingPatches = useRef(new Map<string, { path: string; patch: Record<string, unknown>; revision: number }>())
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
  async function reportPhotoUploadFailure(upload: PhotoUploadState, storagePath: string, code: 'PHOTO_UPLOAD_ERROR' | 'NETWORK_ERROR', status?: number, storageCode?: string) {
    try { await fieldApi(token, 'photo-upload-events', { method: 'POST', body: JSON.stringify({ inspectionId: session?.inspection.id, inspectionAreaId: upload.areaId, inspectionItemId: upload.itemId, storagePath, code, status, storageCode }) }) } catch {}
  }
  function photoErrorMessage(code: PhotoErrorCode) {
    if (code === 'PHOTO_AUTHORIZATION_ERROR') return 'Photo upload could not be authorised. Tap Retry.'
    if (code === 'PHOTO_REGISTER_ERROR') return 'The photo could not be attached to the inspection. Tap Retry; the selected photo is still available.'
    if (code === 'NETWORK_ERROR') return 'The connection was interrupted. Tap Retry; the selected photo is still available.'
    return 'Photo upload failed. Tap Retry; the selected photo is still available.'
  }
  async function performPhotoUpload(upload: PhotoUploadState) {
    if (!session || !token) return
    const area = session.areas.find((entry) => entry.id === upload.areaId)
    if (!area) return
    setError('')
    setPhotoUpload({ ...upload, status: 'uploading', errorCode: undefined, message: undefined })
    let storagePath = ''
    try {
      const authorization = await fieldApi<PhotoUploadAuthorization>(token, 'photo-upload-url', { method: 'POST', body: JSON.stringify({ inspectionId: session.inspection.id, inspectionAreaId: upload.areaId, inspectionItemId: upload.itemId, filename: upload.file.name, contentType: upload.file.type }) })
      storagePath = authorization.storagePath
      const form = new FormData(); form.append('cacheControl', '3600'); form.append('', upload.file, upload.file.name)
      let response: Response
      try { response = await fetch(authorization.signedUrl, { method: 'PUT', headers: { 'x-upsert': 'false' }, body: form }) } catch { await reportPhotoUploadFailure(upload, storagePath, 'NETWORK_ERROR'); throw new FieldApiError('NETWORK_ERROR', 'The network connection was interrupted.') }
      if (!response.ok) {
        const storageError = await response.json().catch(() => ({})) as { code?: string; statusCode?: string }
        await reportPhotoUploadFailure(upload, storagePath, 'PHOTO_UPLOAD_ERROR', response.status, storageError.code || storageError.statusCode)
        throw new FieldApiError('PHOTO_UPLOAD_ERROR', 'The photograph could not be uploaded.')
      }
      await fieldApi(token, 'photos', { method: 'POST', body: JSON.stringify({ inspectionId: session.inspection.id, inspectionAreaId: upload.areaId, inspectionItemId: upload.itemId, storagePath, displayOrder: area.photos.length }) })
      setPhotoUpload({ ...upload, status: 'success', message: 'Photo uploaded' })
      try { const refreshed = await fieldApi<FieldSession>(token, 'session'); setSession(refreshed) } catch { setError('Photo uploaded. Refresh the inspection to display it.') }
    } catch (reason) {
      const code = reason instanceof FieldApiError && ['PHOTO_AUTHORIZATION_ERROR', 'PHOTO_UPLOAD_ERROR', 'PHOTO_REGISTER_ERROR', 'NETWORK_ERROR'].includes(reason.code) ? reason.code as PhotoErrorCode : 'NETWORK_ERROR'
      setPhotoUpload({ ...upload, status: 'error', errorCode: code, message: photoErrorMessage(code) })
    }
  }
  async function selectPhoto(file: File, areaId: string, itemId: string | null = null) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { setError('Use a JPEG, PNG or WebP image under 10 MB.'); return }
    setError('')
    const initial = { file, areaId, itemId, status: 'uploading' as const }
    setPhotoUpload(initial)
    try { const prepared = await prepareImage(file); await performPhotoUpload({ ...initial, file: prepared }) } catch { setPhotoUpload({ ...initial, status: 'error', errorCode: 'PHOTO_UPLOAD_ERROR', message: photoErrorMessage('PHOTO_UPLOAD_ERROR') }) }
  }
  async function finish() { if (!session || saveState === 'saving') return; const unanswered = session.areas.flatMap((area) => area.items).filter((item) => item.required && item.status === 'not_checked').length; const urgent = session.areas.flatMap((area) => area.items).filter((item) => item.status === 'urgent').length; const attention = session.areas.flatMap((area) => area.items).filter((item) => item.status === 'attention').length; if (!window.confirm(`Complete field inspection?\n\n${progress.areas}/${session.areas.length} areas complete\n${unanswered} required items unanswered\n${attention} attention items\n${urgent} urgent items\n\nThe client will not see this until Guardemar reviews and publishes it.`)) return; try { await fieldApi(token, 'complete', { method: 'POST', body: JSON.stringify({ allowIncomplete: unanswered > 0 }) }); sessionStorage.removeItem(`guardemar:inspection-draft:${session.inspection.id}`); sessionStorage.removeItem('guardemar:inspection-token'); setCompleted(true) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Completion failed.') } }
  if (!token) return <main className="field-error"><ShieldCheck /><h1>Inspection link required</h1><p>Open the secure Guardemar link supplied for this visit.</p></main>
  if (error && !session) return <main className="field-error"><AlertTriangle /><h1>Inspection unavailable</h1><p>{error}</p></main>
  if (!session) return <main className="field-loading"><LoaderCircle className="spin" /><p>Opening secure inspection…</p></main>
  if (completed) return <main className="field-error success"><Check /><h1>Field inspection completed</h1><p>The visit is awaiting Guardemar’s internal review. Nothing has been shared with the client yet.</p></main>
  if (!inspectionSetupIsComplete(session.areas.length, session.inspection_setup_complete)) return <main className="field-error setup-incomplete"><AlertTriangle /><p className="field-error-eyebrow">{session.inspection.property_name} · {session.inspection.locality}</p><h1>Inspection setup incomplete</h1><p>This inspection does not contain any configured inspection areas. Please contact Guardemar before starting the visit.</p><dl><div><dt>Inspector</dt><dd>{session.inspection.inspector_name}</dd></div><div><dt>Visit</dt><dd>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date(session.inspection.scheduled_for))}</dd></div></dl></main>
  const safeAreaIndex = clampInspectionAreaIndex(areaIndex, session.areas.length)
  const area = session.areas[safeAreaIndex]
  if (!area) return <main className="field-error setup-incomplete"><AlertTriangle /><h1>Inspection setup incomplete</h1><p>This inspection does not contain any configured inspection areas. Please contact Guardemar before starting the visit.</p></main>
  return <main className="field-app"><header className="field-header"><div><strong>GUARDEMAR</strong><span>{session.inspection.property_name} · {session.inspection.locality}</span></div><div className={`save-indicator ${saveState}`}>{saveState === 'saving' ? <LoaderCircle className="spin" /> : saveState === 'offline' ? <CloudOff /> : <Check />}{saveState === 'saving' ? 'Saving…' : saveState === 'offline' ? 'Connection problem' : 'Saved'}</div><dl><div><dt>Inspection</dt><dd>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date(session.inspection.scheduled_for))}</dd></div><div><dt>Inspector</dt><dd>{session.inspection.inspector_name}</dd></div></dl><div className="field-progress"><span>Areas {progress.areas} / {session.areas.length}</span><span>Checklist {progress.answered} / {progress.total}</span><progress value={progress.answered} max={progress.total || 1} /></div></header>
    <nav className="field-area-nav" aria-label="Inspection areas">{session.areas.map((entry, index) => <button className={index === safeAreaIndex ? 'active' : ''} onClick={() => setAreaIndex(index)} key={entry.id}><span>{index + 1}</span>{entry.custom_label}</button>)}</nav>
    <section className="field-area"><div className="field-area-title"><div><p>{area.area_type} · Area {safeAreaIndex + 1} of {session.areas.length}</p><h1>{area.custom_label}</h1></div></div><div className="field-items">{area.items.map((item) => <article className="field-item" key={item.id}><div className="field-item-title"><h2>{item.label}</h2>{item.guidance && <p>{item.guidance}</p>}</div><div className="field-statuses">{statuses.map((status) => <button className={item.status === status.value ? `selected ${status.value}` : ''} onClick={() => updateItem(area.id, item.id, { status: status.value })} key={status.value}>{status.short}</button>)}</div><details><summary>Add observation or recommendation</summary><label>Observation<textarea value={item.observation ?? ''} onChange={(event) => updateItem(area.id, item.id, { observation: event.target.value })} rows={2} /></label><label>Recommendation<textarea value={item.recommendation ?? ''} onChange={(event) => updateItem(area.id, item.id, { recommendation: event.target.value })} rows={2} /></label></details><label className="field-photo-button"><Camera />Add photo<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ''; if (file) void selectPhoto(file, area.id, item.id) }} /></label></article>)}</div><div className="field-area-notes"><label>Area observation<textarea value={area.observation ?? ''} onChange={(event) => updateArea(area.id, { observation: event.target.value })} rows={3} /></label><label>Area recommendation<textarea value={area.recommendation ?? ''} onChange={(event) => updateArea(area.id, { recommendation: event.target.value })} rows={3} /></label><label className="field-photo-button"><Camera />Add area photo<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ''; if (file) void selectPhoto(file, area.id) }} /></label></div>{photoUpload?.areaId === area.id && <div className={`field-photo-status ${photoUpload.status}`}>{photoUpload.status === 'uploading' ? <><LoaderCircle className="spin" /><span>Uploading photo…</span></> : photoUpload.status === 'success' ? <><Check /><span>Photo uploaded</span></> : <><AlertTriangle /><span>{photoUpload.message}</span><button type="button" onClick={() => { void performPhotoUpload(photoUpload) }}>Retry</button></>}</div>}{error && <p className="field-warning">{error}</p>}<div className="field-footer"><button className="field-previous" disabled={safeAreaIndex === 0} onClick={() => setAreaIndex((value) => value - 1)}><ChevronLeft />Previous</button>{safeAreaIndex < session.areas.length - 1 ? <button className="field-next" onClick={() => setAreaIndex((value) => value + 1)}>Next area<ChevronRight /></button> : <button className="field-complete" disabled={saveState === 'saving' || photoUpload?.status === 'uploading'} onClick={() => { void finish() }}>Complete inspection<Check /></button>}</div></section>
  </main>
}
