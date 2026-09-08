import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, ChevronLeft, Clipboard, Clock, ExternalLink, MessageCircle, Share2 } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { InspectionReport, StatusMark, statusLabel } from '@/components/portal/inspection-report'
import { PrivateImage } from '@/components/portal/private-image'
import { PrivateVideo } from '@/components/portal/private-video'
import { PrivateShell } from '@/components/portal/shell'
import { baselineConditionProductName, baselineStatusLabels } from '@/config/baseline-condition'
import { portalApi } from '@/lib/portal/api'
import { mediaForArea, type AdminInspectionDetail, type BaselineComment, type ClientInspectionReport, type InspectionArea, type InspectionItem, type PortalProfile } from '@/lib/portal/types'

function MediaGrid({ inspectionId, area, reload }: { inspectionId: string; area: InspectionArea; reload: () => Promise<void> }) {
  const items = mediaForArea(area)
  if (items.length === 0) return null
  async function move(mediaId: string, offset: number) {
    const index = items.findIndex((item) => item.id === mediaId)
    const target = index + offset
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    await portalApi(`admin/inspections/${inspectionId}/areas/${area.id}/media-reorder`, { method: 'POST', body: JSON.stringify({ orderedIds: next.map((item) => item.id) }) })
    await reload()
  }
  return <div className="review-photo-grid">{items.map((item, index) => <article key={item.id}>
    {item.media_type === 'video'
      ? <PrivateVideo path={item.storage_path} posterPath={item.poster_storage_path} caption={item.caption} />
      : <PrivateImage bucket="inspection-photos" path={item.storage_path} alt={item.caption || area.custom_label} />}
    {item.media_type === 'video' && item.duration_seconds && <span className="media-duration-pill"><Clock />{Math.floor(item.duration_seconds / 60)}:{String(item.duration_seconds % 60).padStart(2, '0')}</span>}
    <input defaultValue={item.caption ?? ''} placeholder="Client caption" onBlur={(event) => { void portalApi(`admin/inspections/${inspectionId}/media/${item.id}`, { method: 'PATCH', body: JSON.stringify({ caption: event.target.value }) }) }} />
    <label className="check-field"><input type="checkbox" defaultChecked={item.client_visible} onChange={(event) => { void portalApi(`admin/inspections/${inspectionId}/media/${item.id}`, { method: 'PATCH', body: JSON.stringify({ clientVisible: event.target.checked }) }) }} /> Share with client</label>
    <div className="media-grid-actions">
      <button type="button" className="private-secondary compact" onClick={() => { void move(item.id, -1) }} disabled={index === 0} aria-label="Move earlier"><ArrowLeft /></button>
      <button type="button" className="private-secondary compact" onClick={() => { void move(item.id, 1) }} disabled={index === items.length - 1} aria-label="Move later"><ArrowRight /></button>
      <button type="button" className="text-danger" onClick={() => { void portalApi(`admin/inspections/${inspectionId}/media/${item.id}`, { method: 'PATCH', body: JSON.stringify({ rejected: true }) }).then(reload) }}>Remove</button>
    </div>
  </article>)}</div>
}

function BaselineCommentsPanel({ inspectionId }: { inspectionId: string }) {
  const [comments, setComments] = useState<BaselineComment[]>([])
  const [loading, setLoading] = useState(true)
  const load = () => portalApi<{ baseline: { comments: BaselineComment[] } }>(`admin/inspections/${inspectionId}/baseline`).then((data) => setComments(data.baseline.comments)).finally(() => setLoading(false))
  useEffect(() => { void load() }, [inspectionId])
  async function respond(event: FormEvent<HTMLFormElement>, commentId: string) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await portalApi(`admin/inspections/${inspectionId}/baseline-comments/${commentId}/respond`, { method: 'POST', body: JSON.stringify({ responseText: form.get('responseText') }) })
    event.currentTarget.reset()
    await load()
  }
  if (loading || comments.length === 0) return null
  return <section className="private-panel baseline-comments-panel"><div className="panel-heading"><h2>Client comments on the {baselineConditionProductName}</h2><p>The original observation and photographs are never altered — a response is added alongside the client's comment.</p></div>{comments.map((comment) => <article className="baseline-comment" key={comment.id}><p className="baseline-comment-text">“{comment.commentText}”</p><small>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(comment.createdAt))}</small>{comment.staffResponseText ? <div className="baseline-comment-response"><strong>Guardemar response</strong><p>{comment.staffResponseText}</p></div> : <form onSubmit={(event) => { void respond(event, comment.id) }}><textarea name="responseText" rows={2} placeholder="Respond to this comment" required /><button className="private-secondary compact">Send response</button></form>}</article>)}</section>
}

export const Route = createFileRoute('/admin/inspections_/$id')({ component: InspectionRoute })
function InspectionRoute() { return <PrivateGuard area="admin">{(profile) => <Inspection profile={profile} />}</PrivateGuard> }

async function sha256(value: string) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('') }
function randomToken() { const bytes = crypto.getRandomValues(new Uint8Array(32)); return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '') }

function ReviewArea({ inspectionId, area, reload }: { inspectionId: string; area: InspectionArea; reload: () => Promise<void> }) {
  async function saveArea(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await portalApi(`admin/inspections/${inspectionId}/areas/${area.id}`, { method: 'PATCH', body: JSON.stringify({ status: form.get('status'), observation: form.get('observation'), recommendation: form.get('recommendation'), observationClientVisible: form.get('observationClientVisible') === 'on', recommendationClientVisible: form.get('recommendationClientVisible') === 'on' }) }); await reload() }
  async function saveItem(event: FormEvent<HTMLFormElement>, item: InspectionItem) { event.preventDefault(); const form = new FormData(event.currentTarget); await portalApi(`admin/inspections/${inspectionId}/items/${item.id}`, { method: 'PATCH', body: JSON.stringify({ status: form.get('status'), observation: form.get('observation'), recommendation: form.get('recommendation'), observationClientVisible: form.get('observationClientVisible') === 'on', recommendationClientVisible: form.get('recommendationClientVisible') === 'on' }) }); await reload() }
  return <section className="private-panel review-area"><div className="panel-heading"><div><p className="private-eyebrow">{area.area_type}</p><h2>{area.custom_label}</h2></div><StatusMark status={area.status === 'not_checked' ? area.suggested_status : area.status} /></div>{area.baseline && <p className="baseline-comparison-hint"><strong>At baseline:</strong> {statusLabel(area.baseline.status)}{area.baseline.observation ? ` — ${area.baseline.observation}` : ''}</p>}<form className="review-form" onSubmit={saveArea}><label>Area status<select name="status" defaultValue={area.status}>{['good', 'attention', 'urgent', 'not_checked', 'not_applicable'].map((value) => <option value={value} key={value}>{statusLabel(value)}</option>)}</select></label><label>Area observation<textarea name="observation" rows={2} defaultValue={area.observation ?? ''} /></label><label className="check-field"><input name="observationClientVisible" type="checkbox" defaultChecked={area.observation_client_visible} /> Client-visible</label><label>Area recommendation<textarea name="recommendation" rows={2} defaultValue={area.recommendation ?? ''} /></label><label className="check-field"><input name="recommendationClientVisible" type="checkbox" defaultChecked={area.recommendation_client_visible} /> Client-visible</label><button className="private-secondary">Save area review</button></form><div className="review-items">{area.items.map((item) => <form key={item.id} className="review-item" onSubmit={(event) => { void saveItem(event, item) }}><div className="review-item-head"><strong>{item.label}</strong><select name="status" defaultValue={item.status}>{['good', 'attention', 'urgent', 'not_checked', 'not_applicable'].map((value) => <option value={value} key={value}>{statusLabel(value)}</option>)}</select></div><textarea name="observation" rows={2} defaultValue={item.observation ?? ''} placeholder="Observation" /><label className="check-field"><input name="observationClientVisible" type="checkbox" defaultChecked={item.observation_client_visible} /> Share observation</label><textarea name="recommendation" rows={2} defaultValue={item.recommendation ?? ''} placeholder="Recommendation" /><label className="check-field"><input name="recommendationClientVisible" type="checkbox" defaultChecked={item.recommendation_client_visible} /> Share recommendation</label><button className="private-secondary compact">Save item</button></form>)}</div><MediaGrid inspectionId={inspectionId} area={area} reload={reload} /></section>
}

function Inspection({ profile }: { profile: PortalProfile }) {
  const { id } = Route.useParams(); const [detail, setDetail] = useState<AdminInspectionDetail | null>(null); const [preview, setPreview] = useState<ClientInspectionReport | null>(null); const [fieldLink, setFieldLink] = useState(''); const [notice, setNotice] = useState(''); const [publishing, setPublishing] = useState(false)
  const load = async () => { const data = await portalApi<AdminInspectionDetail>(`admin/inspections/${id}`); setDetail(data) }
  useEffect(() => { void load() }, [id])
  async function generateLink() { const token = randomToken(); const tokenHash = await sha256(token); const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString(); await portalApi(`admin/inspections/${id}/link`, { method: 'POST', body: JSON.stringify({ tokenHash, expiresAt }) }); const link = `${window.location.origin}/i#${token}`; setFieldLink(link); setNotice('A new seven-day inspection link was generated. Any previous link is revoked.') }
  async function review(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await portalApi(`admin/inspections/${id}/review`, { method: 'PATCH', body: JSON.stringify({ finalCondition: form.get('finalCondition'), clientSummary: form.get('clientSummary'), internalReviewNotes: form.get('internalReviewNotes') }) }); setNotice('Review saved.'); await load() }
  async function showPreview() { const data = await portalApi<{ inspection: ClientInspectionReport }>(`admin/inspections/${id}/preview`); setPreview(data.inspection) }
  async function publish() { if (!window.confirm('Share this inspection with the client? Once shared, the approved report becomes available in the Guardemar portal.')) return; setPublishing(true); try { await portalApi(`admin/inspections/${id}/publish`, { method: 'POST' }); setNotice('Inspection shared with the client.'); await load(); await showPreview() } finally { setPublishing(false) } }
  if (!detail) return <PrivateShell area="admin" profile={profile} title="Inspection"><div className="private-panel">Loading inspection…</div></PrivateShell>
  const inspection = detail.inspection; const canLink = ['scheduled', 'in_progress'].includes(inspection.status); const canReview = inspection.status === 'awaiting_review';
  return <PrivateShell area="admin" profile={profile} title={inspection.property_name} eyebrow={`${new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date(inspection.scheduled_for))} · ${inspection.inspector_name}`} action={<Link className="private-secondary" to="/admin/inspections"><ChevronLeft />Inspections</Link>}>
    {inspection.is_baseline && <p className="baseline-banner"><strong>{baselineConditionProductName}</strong> — this is the property's baseline condition record.{inspection.baseline_state && ` Client status: ${baselineStatusLabels[inspection.baseline_state]}.`}</p>}
    <div className="inspection-command"><div><span>Status</span><strong>{statusLabel(inspection.status)}</strong></div><div><span>Overall condition</span>{inspection.final_condition || inspection.suggested_condition ? <StatusMark status={inspection.final_condition || inspection.suggested_condition!} /> : <strong>Not assessed</strong>}</div>{canLink && profile.role === 'admin' && <button className="private-primary" onClick={() => { void generateLink() }}><Share2 />Generate inspection link</button>}<button className="private-secondary" onClick={() => { void showPreview() }}><ExternalLink />Preview as client</button>{canReview && profile.role === 'admin' && <button className="private-primary" disabled={publishing} onClick={() => { void publish() }}>{publishing ? 'Sharing…' : 'Share with client'}</button>}</div>
    {inspection.is_baseline && inspection.status === 'published' && <BaselineCommentsPanel inspectionId={id} />}
    {notice && <p className="form-notice">{notice}</p>}{fieldLink && <section className="private-panel field-link-panel" aria-labelledby="field-link-title"><div><p className="private-eyebrow">Field team access</p><h2 id="field-link-title">Secure field link</h2><p>The plaintext token is shown only now. Regenerate the link if it is lost.</p></div><code>{fieldLink}</code><div className="heading-actions"><button className="private-secondary" onClick={() => { void navigator.clipboard.writeText(fieldLink); setNotice('Inspection link copied.') }}><Clipboard />Copy link</button><a className="private-primary" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Guardemar inspection\n\n${inspection.property_name} — ${inspection.locality}\n\nOpen the inspection checklist:\n${fieldLink}`)}`}><MessageCircle />WhatsApp</a></div></section>}
    {canReview && <form className="private-panel review-summary" onSubmit={review}><div className="panel-heading"><h2>Internal review</h2><p>Choose exactly what becomes part of the client report.</p></div><label>Final overall condition<select name="finalCondition" defaultValue={inspection.final_condition || inspection.suggested_condition || 'good'}><option value="good">Good</option><option value="attention">Attention</option><option value="urgent">Urgent</option></select></label><label>Final client summary<textarea name="clientSummary" rows={4} defaultValue={inspection.client_summary ?? ''} /></label><label>Internal review notes <span>Never client-visible</span><textarea name="internalReviewNotes" rows={4} defaultValue={inspection.internal_review_notes ?? ''} /></label><button className="private-primary">Save review</button></form>}
    {preview ? <InspectionReport report={preview} preview={inspection.status !== 'published'} /> : <div className="review-stack">{detail.areas.map((area) => <ReviewArea inspectionId={id} area={area} reload={load} key={area.id} />)}</div>}
  </PrivateShell>
}
