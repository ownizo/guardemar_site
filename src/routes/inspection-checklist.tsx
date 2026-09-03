import { createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, CheckCircle2, CircleAlert } from 'lucide-react'
import { AssessmentCta, Breadcrumbs, PageHero } from '@/components/site'

const categories=[
  ['Security & access',['Front and secondary doors','Window and shutter condition','Locks and visible forced entry signs','Alarm status where authorised','External gates and garage access']],
  ['Water & plumbing',['Visible leaks and unusual moisture','Taps, toilets and cisterns','Under-sink inspection','Water heater visual status','Visible pipework and drain smells']],
  ['Moisture & building condition',['Humidity reading','Damp, mould and condensation','Ceiling and wall stains','Visible cracks and floor condition','Unusual smells']],
  ['Electrical',['Main power status','Consumer board visual status','Lighting sample','Obvious electrical faults','Appliance indicators where agreed']],
  ['Air conditioning & ventilation',['Visual unit status','Basic operating test where agreed','Unusual smells','Ventilation','Property airing to client instruction']],
  ['Kitchen',['Fridge/freezer status where required','Visible appliance issues','Under-sink check','Odours','Visible pest indicators']],
  ['Bathrooms',['Toilets, taps and showers','Visible seals','Drains','Humidity','Mould indicators']],
  ['Exterior',['Roof visible from ground level','Terraces, balconies and walls','Gates and driveway','Storm damage and fallen branches','Outdoor furniture and visible drainage problems']],
  ['Pool',['Water appearance and level','Visible pump indicators','Pool surroundings','Obvious leaks or damage','Visual condition only — not professional pool maintenance']],
  ['Garden & irrigation',['General condition','Obvious irrigation problems','Fallen trees or branches','Dry areas','Storm damage']],
  ['Mail',['Mailbox check','Important-looking correspondence notification','Parcel status by arrangement']],
  ['Report',['Date, time and inspector','Condition summary','Photographs','Issues and priority level','Recommended next action']],
] as const

export const Route=createFileRoute('/inspection-checklist')({head:()=>({meta:[{title:'Holiday Home Inspection Checklist Algarve | Guardemar'},{name:'description',content:'See the structured security, water, moisture, electrical, exterior, pool and garden checks used in Guardemar home watch visits.'}],links:[{rel:'canonical',href:'https://guardemar.com/inspection-checklist/'}]}),component:ChecklistPage})
function ChecklistPage(){return <><Breadcrumbs items={[{label:'Home',to:'/'},{label:'Inspection checklist'}]}/><PageHero eyebrow="Property inspection checklist" title="A consistent check. A useful record. A clear next action." text="The checklist is adapted to each home, but the principle remains the same: observe systematically, record condition and make any concern easy to understand from abroad." aside="A visual, non-invasive condition check designed for continuity — not a technical certification."/><section className="section shell"><div className="status-legend"><span><CheckCircle2/>Good</span><span><CircleAlert/>Attention</span><span><AlertTriangle/>Urgent</span></div><div className="checklist-grid">{categories.map(([title,items])=><article key={title}><p className="eyebrow">Inspection area</p><h2>{title}</h2><ul>{items.map(item=><li key={item}>{item}</li>)}</ul></article>)}</div><div className="inspection-note"><strong>Important scope note</strong><p>Guardemar inspections are visual and non-invasive. They do not replace technical surveys, specialist maintenance or structural, electrical, plumbing, pool or engineering certification, and cannot guarantee detection of hidden defects.</p></div></section><AssessmentCta title="Put a structured inspection around your property."/></>}
