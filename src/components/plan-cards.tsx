import { Check } from 'lucide-react'

import { ButtonLink } from '@/components/site'
import { formatEuro, plans, privateEstate } from '@/config/site'

// Shared plan cards for the homepage and the plans page, so the visit
// frequency and prices always come from the same canonical configuration.
export function PlanCards({ detailed = false, linkTo = '/contact/', buttonLabel = 'Request an assessment' }: { detailed?: boolean; linkTo?: string; buttonLabel?: string }) {
  return (
    <div className={`plans-grid ${detailed ? 'detailed-plans' : ''}`}>
      {plans.map((plan) => (
        <article className="plan-card" key={plan.name}>
          <p className="eyebrow">{plan.name}</p>
          <p className="plan-visits"><strong>{plan.visits}</strong><span>{plan.visitsPerYear}</span></p>
          <div className="price"><strong>{formatEuro(plan.grossPrice)}</strong><span>/month incl. VAT</span></div>
          {detailed && <p className="annual-plan-price"><strong>{formatEuro(plan.grossAnnualPrice)}/year incl. VAT</strong><span>Save {formatEuro(plan.grossAnnualSaving)} · 10% · {formatEuro(plan.price)}/month + VAT</span></p>}
          <p>{plan.description}</p>
          <ul>{(detailed ? plan.items : plan.highlights).map((item) => <li key={item}><Check size={15} />{item}</li>)}</ul>
          <ButtonLink to={linkTo} variant="outline" event="plan_cta_click">{buttonLabel}</ButtonLink>
        </article>
      ))}
    </div>
  )
}

export function PrivateEstateCard() {
  return (
    <article className="plan-card popular private-estate-card">
      <div>
        <p className="eyebrow">{privateEstate.name}</p>
        <p className="plan-visits"><strong>{privateEstate.visits}</strong><span>{privateEstate.pricing}</span></p>
        <p>{privateEstate.description}</p>
        <ButtonLink to="/contact/" event="plan_cta_click">Request a private proposal</ButtonLink>
      </div>
      <ul>{privateEstate.highlights.map((item) => <li key={item}><Check size={15} />{item}</li>)}</ul>
    </article>
  )
}
