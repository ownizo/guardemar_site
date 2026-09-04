import { createFileRoute } from '@tanstack/react-router'

import { AssessmentDetailsForm } from '@/components/assessment-details-form'
import { Breadcrumbs, PageHero } from '@/components/site'
import { pageHead } from '@/lib/seo'

export const Route=createFileRoute('/contact/property-assessment')({head:()=>pageHead({title:'Property Assessment Details | Guardemar',description:'Optional second-step property information for an existing Guardemar enquiry.',path:'/contact/property-assessment/',noindex:true}),component:AssessmentDetailsPage})

function AssessmentDetailsPage(){return <><Breadcrumbs items={[{label:'Home',to:'/'},{label:'Contact',to:'/contact/'},{label:'Property details'}]}/><PageHero eyebrow="Optional second step" title="Add practical detail about the property." text="Complete this questionnaire after sending the first enquiry if you already have the information to hand." aside="This step is optional. Guardemar can gather the same detail during the first conversation."/><section className="section shell contact-layout"><div><AssessmentDetailsForm/></div><aside className="contact-card"><h2>Useful information</h2><p>Approximate size, vacancy pattern, pool and garden arrangements, current providers and preferred visit frequency help prepare the first assessment.</p><p>Do not include alarm codes, key locations or other sensitive access instructions in this form.</p></aside></section></>}
