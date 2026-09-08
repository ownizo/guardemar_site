import { createFileRoute } from '@tanstack/react-router'
import { Check, ChevronLeft, ChevronRight, CreditCard, Download, FileText, Home, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { PrivateShell } from '@/components/portal/shell'
import { annualDiscountPercent, billingCopy, calculateTaxAmount, formatEuro, selectedAmount, subscriptionPlans, subscriptionTerms, type SubscriptionBillingInterval, type SubscriptionPlanCode } from '@/config/subscriptions'
import { subscriptionApi } from '@/lib/portal/subscriptions'
import type { PortalProfile } from '@/lib/portal/types'

export const Route = createFileRoute('/portal/subscriptions_/new')({ component: Page })

type PropertyOption = { id: string; client_id: string; display_name: string; address_line_1: string; address_line_2?: string; postal_code: string; locality: string; municipality: string; country: string; clients: { first_name: string; last_name: string; email: string } | null }
type ContractAcknowledgement = { key: string; text: string; displayText: string }
type Options = {
  properties: PropertyOption[]
  terms: { available: boolean; document_text?: string; sha256: string; error?: string }
  feeSchedule: { available: boolean; effective_date?: string; sha256: string; error?: string }
  tax: { available: boolean; percentage?: number; displayName?: string; error?: string }
  acknowledgements: ContractAcknowledgement[]
  mainTermsAcceptance: string | null
  serviceOrderAcceptance: string | null
  withdrawalClause: string | null
  contractClauses?: Record<string, string>
}

const steps = ['Your property', 'Care plan', 'Billing', 'Service Order', 'General Conditions', 'Important acknowledgements', 'Payment', 'Confirmation']

function Page() { return <PrivateGuard area="portal">{(profile) => <Wizard profile={profile} />}</PrivateGuard> }

function downloadCanonicalTerms(documentText: string) {
  const url = URL.createObjectURL(new Blob([documentText], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `guardemar-general-terms-v${subscriptionTerms.version}.md`
  link.click()
  URL.revokeObjectURL(url)
}

function Wizard({ profile }: { profile: PortalProfile }) {
  const [options, setOptions] = useState<Options | null>(null)
  const [step, setStep] = useState(0)
  const [propertyId, setPropertyId] = useState('')
  const [planCode, setPlanCode] = useState<SubscriptionPlanCode>('care_plus')
  const [billingInterval, setBillingInterval] = useState<SubscriptionBillingInterval>('year')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [consumer, setConsumer] = useState<'yes' | 'no' | ''>('')
  const [earlyStart, setEarlyStart] = useState(false)
  const [termsOpened, setTermsOpened] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    subscriptionApi<Options>('options').then((value) => {
      setOptions(value)
      if (value.properties.length === 1) setPropertyId(value.properties[0].id)
    }).catch((loadError) => setError(loadError.message))
  }, [])

  const property = options?.properties.find((item) => item.id === propertyId)
  const plan = subscriptionPlans[planCode]
  const netAmount = selectedAmount(planCode, billingInterval)
  const taxAmount = options?.tax.available && options.tax.percentage !== undefined ? calculateTaxAmount(netAmount, options.tax.percentage) : null
  const grossAmount = taxAmount === null ? null : netAmount + taxAmount
  const fourteenDaysFromToday = useMemo(() => {
    const date = new Date()
    date.setUTCDate(date.getUTCDate() + 14)
    return date.toISOString().slice(0, 10)
  }, [])
  const earlyStartRequired = consumer === 'yes' && startDate <= fourteenDaysFromToday
  const annexAccepted = Boolean(options?.acknowledgements.length) && options!.acknowledgements.every((item) => checks[item.key] === true)
  const allAccepted = checks.serviceOrder === true && checks.mainTerms === true && annexAccepted && consumer !== '' && (!earlyStartRequired || earlyStart)
  const configurationReady = Boolean(options?.terms.available && options?.feeSchedule.available && options?.tax.available && grossAmount !== null)
  const canContinue = [Boolean(propertyId), true, true, Boolean(property) && checks.serviceOrder === true && configurationReady, checks.mainTerms === true && termsOpened && Boolean(options?.terms.available), annexAccepted && consumer !== '' && (!earlyStartRequired || earlyStart), false, false][step]

  const serviceOrder = useMemo(() => ({
    supplier: 'GUARDEMAR / Ownizo Unipessoal Lda',
    client: property?.clients ? `${property.clients.first_name} ${property.clients.last_name}` : 'Guardemar client',
    clientEmail: property?.clients?.email || 'Not available',
    property: property?.display_name,
    propertyAddress: property ? [property.address_line_1, property.address_line_2, property.postal_code, property.locality, property.municipality, property.country].filter(Boolean).join(', ') : '',
    plan: plan.name,
    serviceFrequency: plan.frequency,
    serviceScope: plan.scope.join('; '),
    billingOption: billingInterval === 'month' ? 'Monthly' : 'Annual',
    monthlyPlanFeeNet: formatEuro(plan.monthlyAmount),
    twelveMonthEquivalentNet: formatEuro(plan.annualListAmount),
    annualDiscount: billingInterval === 'year' ? `${formatEuro(plan.annualDiscountAmount)} / ${annualDiscountPercent}%` : 'Not applicable to Monthly Billing',
    agreedPlanFeeNet: formatEuro(netAmount),
    tax: taxAmount === null ? 'Production VAT configuration is required before acceptance.' : `${options?.tax.displayName} ${options?.tax.percentage}% — ${formatEuro(taxAmount)}`,
    amountBeingCharged: grossAmount === null ? 'Unavailable until production VAT is configured' : formatEuro(grossAmount),
    feeSchedule: `Applicable from 5 September 2026 · SHA-256 ${options?.feeSchedule.sha256 || 'Unavailable'}`,
    startDate,
    contractTerm: options?.contractClauses?.['5.2'] || 'Unavailable',
    renewalArrangement: options?.contractClauses?.['5.3'] || 'Unavailable',
    billingWording: options?.contractClauses?.[billingInterval === 'month' ? '15.3' : '15.4'] || 'Unavailable',
    terms: `Version ${subscriptionTerms.version}, effective ${subscriptionTerms.effectiveDateLabel}`,
    termsSha256: options?.terms.sha256 || subscriptionTerms.sha256,
  }), [billingInterval, grossAmount, netAmount, options, plan, property, startDate, taxAmount])

  async function proceedToCheckout() {
    if (!allAccepted || !configurationReady) return
    setPending(true)
    setError('')
    try {
      const accepted = await subscriptionApi<{ subscriptionId: string }>('accept', {
        method: 'POST',
        body: JSON.stringify({ idempotencyKey, propertyId, planCode, billingInterval, startDate, acknowledgements: checks, isConsumer: consumer === 'yes', earlyStartRequested: earlyStartRequired && earlyStart }),
      })
      const checkout = await subscriptionApi<{ url: string }>('checkout', { method: 'POST', body: JSON.stringify({ subscriptionId: accepted.subscriptionId }) })
      setStep(7)
      window.location.assign(checkout.url)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Checkout could not be prepared.')
      setPending(false)
    }
  }

  return <PrivateShell area="portal" profile={profile} title="Start Guardemar service" eyebrow="Secure subscription and agreement">
    <ol className="subscription-steps" aria-label="Subscription steps">{steps.map((label, index) => <li className={index === step ? 'active' : index < step ? 'complete' : ''} key={label} aria-current={index === step ? 'step' : undefined}><span aria-hidden="true">{index < step ? <Check /> : index + 1}</span><small>{label}</small></li>)}</ol>
    {error && <div className="private-error">{error}</div>}
    <section className="private-panel subscription-wizard">
      {step === 0 && <div><h2><Home />Choose your property</h2><p>Only properties assigned to your Guardemar portal account are available.</p><div className="property-choice-list">{options?.properties.map((item) => <label className={propertyId === item.id ? 'property-choice selected' : 'property-choice'} key={item.id}><input type="radio" checked={propertyId === item.id} onChange={() => setPropertyId(item.id)} /><strong>{item.display_name}</strong><span>{item.locality}, {item.municipality}</span></label>)}</div></div>}
      {step === 1 && <div><h2><ShieldCheck />Choose your care plan</h2><div className="plan-choice-grid">{Object.values(subscriptionPlans).map((item) => <label className={planCode === item.code ? 'plan-choice selected' : 'plan-choice'} key={item.code}><input type="radio" checked={planCode === item.code} onChange={() => setPlanCode(item.code)} /><span>{item.name}</span><strong>{item.frequency}</strong><b>{formatEuro(item.monthlyAmount)}/month</b></label>)}</div></div>}
      {step === 2 && <div><h2><CreditCard />Choose billing</h2><div className="billing-choices"><label className={billingInterval === 'year' ? 'billing-card recommended selected' : 'billing-card recommended'}><span>Annual — recommended</span><input type="radio" checked={billingInterval === 'year'} onChange={() => setBillingInterval('year')} /><strong>{formatEuro(plan.yearlyAmount)}/year net</strong><b>Save {formatEuro(plan.annualDiscountAmount)}</b><p>{billingCopy.year}</p></label><label className={billingInterval === 'month' ? 'billing-card selected' : 'billing-card'}><span>Monthly</span><input type="radio" checked={billingInterval === 'month'} onChange={() => setBillingInterval('month')} /><strong>{formatEuro(plan.monthlyAmount)}/month net</strong><p>{billingCopy.month}</p></label></div>{options && !options.tax.available && <div className="legal-blocker"><strong>Production VAT configuration is required.</strong><p>{options.tax.error}</p></div>}</div>}
      {step === 3 && <div><h2><FileText />Review your Service Order</h2><label className="start-date">Requested start date<input type="date" min={new Date().toISOString().slice(0, 10)} value={startDate} onChange={(event) => { setStartDate(event.target.value); setEarlyStart(false) }} /></label><dl className="service-order-preview">{Object.entries(serviceOrder).map(([key, value]) => <div key={key}><dt>{key.replaceAll(/([A-Z])/g, ' $1')}</dt><dd>{value}</dd></div>)}</dl><p>The accepted Service Order is stored as an immutable snapshot before payment. Future price, tax, Fee Schedule, or Terms changes do not alter it.</p><label className="legal-check"><input type="checkbox" checked={checks.serviceOrder === true} onChange={(event) => setChecks({ ...checks, serviceOrder: event.target.checked })} /><span>{options?.serviceOrderAcceptance}</span></label></div>}
      {step === 4 && <div><h2>General Terms and Conditions Version 2.5</h2>{options?.terms.available && options.terms.document_text ? <><p>Version 2.5 — in force from 5 September 2026.</p><details className="service-order-details" onToggle={(event) => { if (event.currentTarget.open) setTermsOpened(true) }}><summary>Open the General Terms and Conditions</summary><div className="terms-document"><pre>{options.terms.document_text}</pre></div></details><button className="private-secondary" type="button" onClick={() => downloadCanonicalTerms(options.terms.document_text!)}><Download />Download Version 2.5</button><p className="muted-copy">Opening the document enables the acceptance control. Guardemar records the explicit acceptance below; opening or scrolling is not treated as proof that the document was read.</p><label className="legal-check"><input type="checkbox" disabled={!termsOpened} checked={checks.mainTerms === true} onChange={(event) => setChecks({ ...checks, mainTerms: event.target.checked })} /><span>{options.mainTermsAcceptance}</span></label></> : <div className="legal-blocker"><strong>The approved Version 2.5 document is unavailable.</strong><p>{options?.terms.error || 'Acceptance and Stripe Checkout remain disabled.'}</p></div>}</div>}
      {step === 5 && <div><h2>Annex C — Client acknowledgements</h2><p>Each item below is taken from Annex C of Version 2.5 and must be confirmed separately.</p><div className="acknowledgement-list">{options?.acknowledgements.map((item) => <label className="legal-check" key={item.key}><input type="checkbox" checked={checks[item.key] === true} onChange={(event) => setChecks({ ...checks, [item.key]: event.target.checked })} /><span>{item.displayText}</span></label>)}</div><fieldset className="consumer-choice"><legend>Consumer withdrawal status</legend><label><input type="radio" name="consumer" checked={consumer === 'yes'} onChange={() => setConsumer('yes')} />I am entering this Agreement as a consumer.</label><label><input type="radio" name="consumer" checked={consumer === 'no'} onChange={() => { setConsumer('no'); setEarlyStart(false) }} />I am not entering this Agreement as a consumer.</label></fieldset>{earlyStartRequired && options?.withdrawalClause && <div className="withdrawal-request"><p>{options.withdrawalClause}</p><label className="legal-check"><input type="checkbox" checked={earlyStart} onChange={(event) => setEarlyStart(event.target.checked)} /><span>Request commencement of the Services during the fourteen-day withdrawal period and acknowledge Clause 5.4.</span></label></div>}</div>}
      {step === 6 && <div className="payment-step"><CreditCard /><h2>Secure Stripe Checkout</h2><p>Contract acceptance is recorded before Stripe Checkout. The browser supplies only the selected plan code and billing interval; the server verifies the canonical live Price, exclusive Tax Rate, and total amount.</p><dl className="details-list"><div><dt>Plan Fee</dt><dd>{formatEuro(netAmount)} net</dd></div><div><dt>{options?.tax.displayName || 'VAT'}</dt><dd>{taxAmount === null ? 'Configuration required' : formatEuro(taxAmount)}</dd></div><div><dt>Total charged by Stripe</dt><dd>{grossAmount === null ? 'Configuration required' : formatEuro(grossAmount)}</dd></div></dl><button className="private-primary" disabled={pending || !allAccepted || !configurationReady} onClick={proceedToCheckout}>{pending ? 'Preparing secure payment…' : `Continue to secure payment · ${grossAmount === null ? 'Unavailable' : formatEuro(grossAmount)}`}</button><p className="muted-copy">Activation occurs only after a verified Stripe webhook confirms the subscription payment.</p></div>}
      {step === 7 && <div className="payment-step"><Check /><h2>Opening secure Checkout</h2><p>Your agreement acceptance has been recorded. Stripe Checkout is opening; activation still depends on the verified payment webhook.</p></div>}
    </section>
    <div className="wizard-actions">{step > 0 && step < 6 && <button className="private-secondary" onClick={() => setStep(step - 1)}><ChevronLeft />Back</button>}{step < 6 && <button className="private-primary" disabled={!canContinue} onClick={() => setStep(step + 1)}>Continue<ChevronRight /></button>}</div>
  </PrivateShell>
}
