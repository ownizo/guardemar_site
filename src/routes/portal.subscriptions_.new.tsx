import { createFileRoute } from '@tanstack/react-router'
import { Check, ChevronLeft, ChevronRight, CreditCard, Download, FileText, Home, MapPin, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { PrivateGuard } from '@/components/portal/auth'
import { PrivateShell } from '@/components/portal/shell'
import { annualDiscountPercent, billingCopy, calculateTaxAmount, formatEuro, selectedAmount, subscriptionPlans, subscriptionTerms, type SubscriptionBillingInterval, type SubscriptionPlanCode } from '@/config/subscriptions'
import { subscriptionApi } from '@/lib/portal/subscriptions'
import type { PortalProfile } from '@/lib/portal/types'

export const Route = createFileRoute('/portal/subscriptions_/new')({ component: Page })

type PropertyOption = { id: string; client_id: string; display_name: string; address_line_1: string; address_line_2?: string; postal_code: string; locality: string; municipality: string; country: string; property_type?: string; clients: { first_name: string; last_name: string; email: string } | null }
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

// Short visual headings for the 13 Annex C clauses. Purely a label above the
// complete, unmodified acknowledgement text -- it does not change what the
// customer reads or agrees to.
const acknowledgementHeadings: Record<string, string> = {
  scope: 'Service scope',
  propertyResponsibility: 'Property responsibility',
  accessMeans: 'Access arrangements',
  contractors: 'Contractor access',
  insurance: 'Insurance',
  baselineCondition: 'Baseline condition record',
  conditionsPrecedent: 'Conditions precedent',
  contractTerm: 'Contract term',
  recurringAuthority: 'Recurring payment authority',
  annualDiscount: 'Annual discount',
  nonPayment: 'Non-payment',
  earlyTermination: 'Early termination',
  liability: 'Liability',
}

function humanizeAcknowledgementKey(key: string) {
  return acknowledgementHeadings[key] ?? key.replaceAll(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())
}

function Page() { return <PrivateGuard area="portal">{(profile) => <Wizard profile={profile} />}</PrivateGuard> }

function downloadCanonicalTerms(documentText: string) {
  const url = URL.createObjectURL(new Blob([documentText], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `guardemar-general-terms-v${subscriptionTerms.version}.md`
  link.click()
  URL.revokeObjectURL(url)
}

function PropertyCard({ property, selected, onSelect }: { property: PropertyOption; selected: boolean; onSelect: () => void }) {
  const addressLines = [property.address_line_1, property.address_line_2].filter(Boolean).join(', ')
  return <label className={selected ? 'property-select-card selected' : 'property-select-card'}>
    <input type="radio" name="property" checked={selected} onChange={onSelect} />
    <span className="property-card-icon"><Home /></span>
    <span className="property-select-body">
      <strong>{property.display_name}</strong>
      <span className="property-select-address"><MapPin />{addressLines}</span>
      <span className="property-select-locality">{property.locality}, {property.municipality}</span>
      {property.property_type && <span className="private-pill">{property.property_type}</span>}
    </span>
    <span className="property-select-state" aria-hidden="true"><Check /></span>
  </label>
}

function PlanCard({ code, selected, onSelect }: { code: SubscriptionPlanCode; selected: boolean; onSelect: () => void }) {
  const plan = subscriptionPlans[code]
  const highlights = plan.scope.slice(0, 4)
  const remaining = plan.scope.length - highlights.length
  return <label className={selected ? `plan-select-card selected ${code}` : `plan-select-card ${code}`}>
    <input type="radio" name="plan" checked={selected} onChange={onSelect} />
    {code === 'care_plus' && <span className="plan-select-tag">Recommended</span>}
    <strong className="plan-select-name">{plan.name}</strong>
    <span className="plan-select-frequency">{plan.frequency}</span>
    <span className="plan-select-price"><b>{formatEuro(plan.monthlyAmount)}</b>/month net</span>
    <ul className="plan-select-features">{highlights.map((item) => <li key={item}>{item}</li>)}</ul>
    {remaining > 0 && <span className="plan-select-more">+{remaining} more included in the Service Order</span>}
  </label>
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

  const propertyAddress = property ? [property.address_line_1, property.address_line_2, property.postal_code, property.locality, property.municipality, property.country].filter(Boolean).join(', ') : ''
  const clientName = property?.clients ? `${property.clients.first_name} ${property.clients.last_name}` : 'Guardemar client'
  const termsSha256 = options?.terms.sha256 || subscriptionTerms.sha256

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
      // Stripe Checkout can be served from a Stripe-verified custom domain (e.g. a
      // checkout.<merchant-domain> configured in the Stripe Dashboard) as well as
      // checkout.stripe.com, so this validates the Stripe-specific URL shape
      // (a live Checkout Session id in the standard hosted-page path) rather than a
      // fixed host. The server already only ever hands back a URL Stripe itself
      // returned for a confirmed-live session (see the checkout endpoint's own
      // session.livemode check) -- this is a defensive check against an
      // empty/malformed response, not the security boundary.
      if (typeof checkout.url !== 'string' || !/^https:\/\/[^/]+\/c\/pay\/cs_live_[A-Za-z0-9]+/.test(checkout.url)) throw new Error('Checkout could not be prepared. Please try again.')
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

      {step === 0 && <div>
        <h2><Home />Choose your property</h2>
        <p>Only properties assigned to your Guardemar portal account are available. This is the property that will be placed under Guardemar's care.</p>
        <div className="property-select-grid">
          {options?.properties.map((item) => <PropertyCard key={item.id} property={item} selected={propertyId === item.id} onSelect={() => setPropertyId(item.id)} />)}
        </div>
      </div>}

      {step === 1 && <div>
        <h2><ShieldCheck />Choose your care plan</h2>
        <p>Each plan is a fixed, published Fee. Compare inspection frequency and scope below.</p>
        <div className="plan-select-grid">
          {Object.values(subscriptionPlans).map((item) => <PlanCard key={item.code} code={item.code} selected={planCode === item.code} onSelect={() => setPlanCode(item.code)} />)}
        </div>
      </div>}

      {step === 2 && <div>
        <h2><CreditCard />Choose billing</h2>
        <div className="billing-choices">
          <label className={billingInterval === 'year' ? 'billing-card recommended selected' : 'billing-card recommended'}>
            <input type="radio" checked={billingInterval === 'year'} onChange={() => setBillingInterval('year')} />
            <span>Annual — recommended</span>
            <strong>{formatEuro(plan.yearlyAmount)}/year net</strong>
            <b>Save {formatEuro(plan.annualDiscountAmount)} · {annualDiscountPercent}%</b>
            <p>{billingCopy.year}</p>
          </label>
          <label className={billingInterval === 'month' ? 'billing-card selected' : 'billing-card'}>
            <input type="radio" checked={billingInterval === 'month'} onChange={() => setBillingInterval('month')} />
            <span>Monthly</span>
            <strong>{formatEuro(plan.monthlyAmount)}/month net</strong>
            <p>{billingCopy.month}</p>
          </label>
        </div>
        {options && !options.tax.available && <div className="legal-blocker"><strong>Production VAT configuration is required.</strong><p>{options.tax.error}</p></div>}
      </div>}

      {step === 3 && <div className="service-order-review">
        <h2><FileText />Review your Service Order</h2>
        <label className="start-date">Requested start date
          <input type="date" min={new Date().toISOString().slice(0, 10)} value={startDate} onChange={(event) => { setStartDate(event.target.value); setEarlyStart(false) }} />
        </label>

        <div className="service-order-group">
          <h3>Property</h3>
          <dl><div><dt>Property</dt><dd>{property?.display_name || 'Not selected'}</dd></div><div><dt>Address</dt><dd>{propertyAddress || 'Not available'}</dd></div></dl>
        </div>

        <div className="service-order-group">
          <h3>Client</h3>
          <dl><div><dt>Supplier</dt><dd>GUARDEMAR / Ownizo Unipessoal Lda</dd></div><div><dt>Client</dt><dd>{clientName}</dd></div><div><dt>Client email</dt><dd>{property?.clients?.email || 'Not available'}</dd></div></dl>
        </div>

        <div className="service-order-group">
          <h3>Service</h3>
          <dl><div><dt>Plan</dt><dd>{plan.name}</dd></div><div><dt>Frequency</dt><dd>{plan.frequency}</dd></div><div><dt>Full scope</dt><dd>{plan.scope.join('; ')}</dd></div></dl>
        </div>

        <div className="service-order-group">
          <h3>Billing</h3>
          <dl>
            <div><dt>Billing option</dt><dd>{billingInterval === 'month' ? 'Monthly' : 'Annual'}</dd></div>
            <div><dt>Monthly Plan Fee (net)</dt><dd>{formatEuro(plan.monthlyAmount)}</dd></div>
            <div><dt>12-month equivalent (net)</dt><dd>{formatEuro(plan.annualListAmount)}</dd></div>
            <div><dt>Annual discount</dt><dd>{billingInterval === 'year' ? `${formatEuro(plan.annualDiscountAmount)} / ${annualDiscountPercent}%` : 'Not applicable to Monthly Billing'}</dd></div>
            <div><dt>Agreed Plan Fee (net)</dt><dd>{formatEuro(netAmount)}</dd></div>
            <div><dt>{options?.tax.displayName || 'VAT'}</dt><dd>{taxAmount === null ? 'Production VAT configuration is required before acceptance.' : `${options?.tax.percentage}% — ${formatEuro(taxAmount)}`}</dd></div>
            <div><dt>Amount being charged</dt><dd>{grossAmount === null ? 'Unavailable until production VAT is configured' : formatEuro(grossAmount)}</dd></div>
            <div><dt>Fee Schedule</dt><dd>Applicable from 5 September 2026 · SHA-256 {options?.feeSchedule.sha256 || 'Unavailable'}</dd></div>
          </dl>
        </div>

        <div className="service-order-group">
          <h3>Contract</h3>
          <dl>
            <div><dt>Start date</dt><dd>{startDate}</dd></div>
            <div><dt>Contract term</dt><dd>{options?.contractClauses?.['5.2'] || 'Unavailable'}</dd></div>
            <div><dt>Renewal arrangement</dt><dd>{options?.contractClauses?.['5.3'] || 'Unavailable'}</dd></div>
            <div><dt>Billing authority</dt><dd>{options?.contractClauses?.[billingInterval === 'month' ? '15.3' : '15.4'] || 'Unavailable'}</dd></div>
            <div><dt>Terms</dt><dd>Version {subscriptionTerms.version}, effective {subscriptionTerms.effectiveDateLabel}</dd></div>
            <div><dt>Terms SHA-256</dt><dd className="hash-value">{termsSha256}</dd></div>
          </dl>
        </div>

        <p className="muted-copy">The accepted Service Order is stored as an immutable snapshot before payment. Future price, tax, Fee Schedule, or Terms changes do not alter it.</p>
        <label className="legal-check service-order-acceptance"><input type="checkbox" checked={checks.serviceOrder === true} onChange={(event) => setChecks({ ...checks, serviceOrder: event.target.checked })} /><span>{options?.serviceOrderAcceptance}</span></label>
      </div>}

      {step === 4 && <div>
        <h2>General Terms and Conditions Version 2.5</h2>
        {options?.terms.available && options.terms.document_text ? <>
          <p>Version 2.5 — in force from 5 September 2026.</p>
          <details className="service-order-details" onToggle={(event) => { if (event.currentTarget.open) setTermsOpened(true) }}>
            <summary>Open the General Terms and Conditions</summary>
            <div className="terms-document"><pre>{options.terms.document_text}</pre></div>
          </details>
          <button className="private-secondary" type="button" onClick={() => downloadCanonicalTerms(options.terms.document_text!)}><Download />Download Version 2.5</button>
          <p className="muted-copy">Opening the document enables the acceptance control. Guardemar records the explicit acceptance below; opening or scrolling is not treated as proof that the document was read.</p>
          <label className="legal-check"><input type="checkbox" disabled={!termsOpened} checked={checks.mainTerms === true} onChange={(event) => setChecks({ ...checks, mainTerms: event.target.checked })} /><span>{options.mainTermsAcceptance}</span></label>
        </> : <div className="legal-blocker"><strong>The approved Version 2.5 document is unavailable.</strong><p>{options?.terms.error || 'Acceptance and Stripe Checkout remain disabled.'}</p></div>}
      </div>}

      {step === 5 && <div>
        <h2>Annex C — Client acknowledgements</h2>
        <p>Each item below is taken from Annex C of Version 2.5 and must be confirmed separately.</p>
        <div className="acknowledgement-list">
          {options?.acknowledgements.map((item) => <label className="legal-check acknowledgement-card" key={item.key}>
            <input type="checkbox" checked={checks[item.key] === true} onChange={(event) => setChecks({ ...checks, [item.key]: event.target.checked })} />
            <span><small>{humanizeAcknowledgementKey(item.key)}</small>{item.displayText}</span>
          </label>)}
        </div>
        <fieldset className="consumer-choice">
          <legend>Consumer withdrawal status</legend>
          <label><input type="radio" name="consumer" checked={consumer === 'yes'} onChange={() => setConsumer('yes')} />I am entering this Agreement as a consumer.</label>
          <label><input type="radio" name="consumer" checked={consumer === 'no'} onChange={() => { setConsumer('no'); setEarlyStart(false) }} />I am not entering this Agreement as a consumer.</label>
        </fieldset>
        {earlyStartRequired && options?.withdrawalClause && <div className="withdrawal-request"><p>{options.withdrawalClause}</p><label className="legal-check"><input type="checkbox" checked={earlyStart} onChange={(event) => setEarlyStart(event.target.checked)} /><span>Request commencement of the Services during the fourteen-day withdrawal period and acknowledge Clause 5.4.</span></label></div>}
      </div>}

      {step === 6 && <div className="payment-step">
        <CreditCard />
        <h2>Secure Stripe Checkout</h2>
        <p>Contract acceptance is recorded before Stripe Checkout. The browser supplies only the selected plan code and billing interval; the server verifies the canonical live Price, exclusive Tax Rate, and total amount.</p>
        <dl className="details-list payment-summary">
          <div><dt>Plan Fee</dt><dd>{formatEuro(netAmount)} net</dd></div>
          <div><dt>{options?.tax.displayName || 'VAT'}</dt><dd>{taxAmount === null ? 'Configuration required' : formatEuro(taxAmount)}</dd></div>
          <div className="payment-summary-total"><dt>Total charged by Stripe</dt><dd>{grossAmount === null ? 'Configuration required' : formatEuro(grossAmount)}</dd></div>
        </dl>
        <button className="private-primary" disabled={pending || !allAccepted || !configurationReady} onClick={proceedToCheckout}>{pending ? 'Preparing secure payment…' : `Continue to secure payment · ${grossAmount === null ? 'Unavailable' : formatEuro(grossAmount)}`}</button>
        <p className="muted-copy">Activation occurs only after a verified Stripe webhook confirms the subscription payment.</p>
      </div>}

      {step === 7 && <div className="payment-step"><Check /><h2>Opening secure Checkout</h2><p>Your agreement acceptance has been recorded. Stripe Checkout is opening; activation still depends on the verified payment webhook.</p></div>}
    </section>
    <div className="wizard-actions">{step > 0 && step < 6 && <button className="private-secondary" onClick={() => setStep(step - 1)}><ChevronLeft />Back</button>}{step < 6 && <button className="private-primary" disabled={!canContinue} onClick={() => setStep(step + 1)}>Continue<ChevronRight /></button>}</div>
  </PrivateShell>
}
