import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { AssessmentCta, Breadcrumbs, PageHero } from '@/components/site'
import { areas } from '@/config/site'

export const Route=createFileRoute('/areas/')({head:()=>({meta:[{title:'Property Care Areas | Western Algarve'},{name:'description',content:'Guardemar serves holiday-home and second-home owners across the Western Algarve, from Carvoeiro to Sagres.'}],links:[{rel:'canonical',href:'https://guardemar.com/areas/'}]}),component:AreasPage})
function AreasPage(){return <><Breadcrumbs items={[{label:'Home',to:'/'},{label:'Areas'}]}/><PageHero eyebrow="Service area" title="Western Algarve — from Carvoeiro to Sagres." text="A deliberately focused territory allows Guardemar to provide practical local oversight across the region’s main second-home communities." aside="Carvoeiro · Portimão · Alvor · Lagos · Praia da Luz · Burgau · Salema · Vila do Bispo · Sagres"/><section className="section shell area-grid">{Object.entries(areas).map(([slug,area])=><Link to={`/areas/${slug}`} className="area-card" key={slug} onClick={()=>window.dispatchEvent(new CustomEvent('guardemar:area-view'))}><span>Western Algarve</span><h2>{area.name}</h2><p>{area.profile}</p><strong>Property care in {area.name} <ArrowRight size={16}/></strong></Link>)}</section><AssessmentCta/></>}
