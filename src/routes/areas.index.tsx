import { createFileRoute } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { AssessmentCta, Breadcrumbs, PageHero } from '@/components/site'
import { areas } from '@/config/site'
import { pageHead } from '@/lib/seo'

export const Route=createFileRoute('/areas/')({head:()=>pageHead({title:'Second-Home Management Areas | Western Algarve',description:'Guardemar manages privately used second homes from Carvoeiro to Sagres, including Lagos, Praia da Luz, Alvor, Portimão and Ferragudo.',path:'/areas/'}),component:AreasPage})
function AreasPage(){return <><Breadcrumbs items={[{label:'Home',to:'/'},{label:'Areas'}]}/><PageHero eyebrow="Where we work" title="Western Algarve — from Carvoeiro to Sagres." text="A deliberately small territory, so the same person can actually get to the house. We manage second homes that are not run as holiday lets." aside="Carvoeiro · Ferragudo · Portimão · Alvor · Lagos · Praia da Luz · Burgau · Salema · Vila do Bispo · Sagres"/><section className="section shell area-grid">{Object.entries(areas).map(([slug,area])=><a href={`/areas/${slug}/`} className="area-card" key={slug} onClick={()=>window.dispatchEvent(new CustomEvent('guardemar:area-view'))}><span>Western Algarve</span><h2>{area.name}</h2><p>{area.profile}</p><strong>Management in {area.name} <ArrowRight size={16}/></strong></a>)}</section><AssessmentCta/></>}
