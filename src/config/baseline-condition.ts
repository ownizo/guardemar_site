// GUARDEMAR Initial Property Condition Report (internal concept: baseline
// condition record). See General Terms Version 2.5, Clause 8.
//
// The acknowledgement wording here is intentionally cautious: it records that
// the customer reviewed the report and, except for anything they flagged,
// the report fairly reflects the visible condition at commencement -- it
// does not purport to waive statutory rights or Guardemar's liability for
// future negligence, and it does not claim the inspection is a technical
// survey capable of identifying concealed or latent defects.
export const baselineConditionProductName = 'Initial Property Condition Report'

export const baselineConditionAcknowledgementVersion = '1.0'

export const baselineConditionAcknowledgementWording = {
  confirmation: "I confirm that I have reviewed the Initial Property Condition Report and that, except for any comments or corrections submitted by me, it fairly records the visible condition of the property at the commencement of Guardemar's service.",
  scopeCaveat: 'I understand that the report is a visual, non-invasive condition record and not a technical survey, and that concealed, latent or inaccessible defects may not be identified.',
} as const

export type BaselineAcknowledgementState = 'pending' | 'comments_received' | 'acknowledged'

export const baselineStatusLabels: Record<'not_created' | 'draft' | BaselineAcknowledgementState, string> = {
  not_created: 'Not created',
  draft: 'Draft',
  pending: 'Awaiting client acknowledgement',
  comments_received: 'Client comments received',
  acknowledged: 'Acknowledged',
}
