import { AlertTriangle, Check, MessageSquarePlus, ShieldCheck } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

import { baselineConditionAcknowledgementWording, baselineConditionProductName, baselineStatusLabels } from '@/config/baseline-condition'
import { portalApi } from '@/lib/portal/api'
import { mediaForArea, type BaselineComment, type BaselineConditionStatus, type ClientInspectionReport, type InspectionArea } from '@/lib/portal/types'

function BaselineCommentForm({ inspectionId, areaId, onDone }: { inspectionId: string; areaId: string; onDone: () => Promise<void> }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      await portalApi(`inspections/${inspectionId}/baseline-comments`, { method: 'POST', body: JSON.stringify({ inspectionAreaId: areaId, commentText: form.get('commentText') }) })
      await onDone()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'The comment could not be submitted.')
    } finally {
      setSubmitting(false)
    }
  }
  return <form className="baseline-comment-form" onSubmit={submit}><textarea name="commentText" rows={3} required placeholder="Describe what you'd like Guardemar to correct or clarify" />{error && <p className="portal-notice warning compact">{error}</p>}<button className="private-secondary compact" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit comment'}</button></form>
}

// Per-condition review row. The customer either leaves a finding as-is
// (nothing is stored -- silence is not acknowledgement, only the final
// acknowledgement below records agreement) or adds a comment/correction
// request, which is stored alongside -- never in place of -- the original
// staff observation. See submit_baseline_condition_comment.
function ConditionRow({ inspectionId, area, comments, onCommentSubmitted }: { inspectionId: string; area: InspectionArea; comments: BaselineComment[]; onCommentSubmitted: () => Promise<void> }) {
  const [showForm, setShowForm] = useState(false)
  const areaComments = comments.filter((comment) => comment.inspectionAreaId === area.id)
  return <article className="baseline-condition-row">
    <div className="baseline-condition-heading"><div><small>{area.area_type}</small><strong>{area.custom_label}</strong></div><span className={`baseline-condition-status status-${area.status}`}>{area.status === 'good' ? <ShieldCheck /> : <AlertTriangle />}{area.status.replaceAll('_', ' ')}</span></div>
    {area.observation && <p className="baseline-condition-observation"><strong>Observed during the initial Guardemar inspection:</strong> {area.observation}</p>}
    {mediaForArea(area).length > 0 && <p className="baseline-condition-photo-count">{mediaForArea(area).length} media item{mediaForArea(area).length === 1 ? '' : 's'} attached to this report.</p>}
    {areaComments.map((comment) => <div className="baseline-comment-existing" key={comment.id}><p>“{comment.commentText}”</p><small>Submitted {new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date(comment.createdAt))}</small>{comment.staffResponseText && <div className="baseline-comment-response"><strong>Guardemar response</strong><p>{comment.staffResponseText}</p></div>}</div>)}
    {!showForm ? <button type="button" className="private-secondary compact" onClick={() => setShowForm(true)}><MessageSquarePlus />Add a comment / request correction</button> : <BaselineCommentForm inspectionId={inspectionId} areaId={area.id} onDone={async () => { setShowForm(false); await onCommentSubmitted() }} />}
  </article>
}

// Review + acknowledgement workflow for a published Initial Property
// Condition Report (baseline condition record). Renders nothing for a
// non-baseline inspection. See src/config/baseline-condition.ts for the
// canonical wording and General Terms v2.5 Clause 8.
export function BaselineReview({ report }: { report: ClientInspectionReport }) {
  const [status, setStatus] = useState<BaselineConditionStatus | null>(null)
  const [acknowledging, setAcknowledging] = useState(false)
  const [ackError, setAckError] = useState('')

  const load = () => portalApi<{ baseline: BaselineConditionStatus }>(`inspections/${report.id}/baseline`).then((data) => setStatus(data.baseline))
  useEffect(() => { void load() }, [report.id])

  async function acknowledge() {
    if (acknowledging) return
    setAcknowledging(true)
    setAckError('')
    try {
      await portalApi(`inspections/${report.id}/baseline-acknowledge`, { method: 'POST' })
      await load()
    } catch (error) {
      setAckError(error instanceof Error ? error.message : 'The acknowledgement could not be recorded.')
    } finally {
      setAcknowledging(false)
    }
  }

  if (!status || !status.isBaseline) return null
  const materialAreas = report.areas.filter((area) => area.status === 'attention' || area.status === 'urgent')
  const acknowledged = status.baselineState === 'acknowledged'

  return <section className="private-panel baseline-review-panel" aria-labelledby="baseline-review-title">
    <div className="panel-heading baseline-review-heading">
      <div>
        <p className="private-eyebrow">GUARDEMAR · {baselineConditionProductName}</p>
        <h2 id="baseline-review-title">{acknowledged ? 'Baseline acknowledged' : 'Review required — Initial Property Condition Report'}</h2>
        <p>{acknowledged ? `You acknowledged this report on ${status.acknowledgement ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(status.acknowledgement.acknowledgedAt)) : ''}.` : 'This is Guardemar’s formal record of your property’s visible condition at the start of service. Please review the findings below before acknowledging.'}</p>
      </div>
      {!acknowledged && <span className="private-pill baseline-review-pill"><AlertTriangle />{status.baselineState ? baselineStatusLabels[status.baselineState] : baselineStatusLabels.pending}</span>}
    </div>

    {materialAreas.length > 0 ? <div className="baseline-condition-list">{materialAreas.map((area) => <ConditionRow key={area.id} inspectionId={report.id} area={area} comments={status.comments} onCommentSubmitted={load} />)}</div> : <p className="baseline-condition-none">No conditions requiring attention were recorded at commencement.</p>}

    {!acknowledged && <div className="baseline-acknowledgement-block">
      <p>{baselineConditionAcknowledgementWording.confirmation}</p>
      <p>{baselineConditionAcknowledgementWording.scopeCaveat}</p>
      {ackError && <p className="portal-notice warning compact">{ackError}</p>}
      <button className="private-primary" type="button" disabled={acknowledging} onClick={() => { void acknowledge() }}><Check />{acknowledging ? 'Recording…' : 'I confirm and acknowledge this report'}</button>
    </div>}
  </section>
}
