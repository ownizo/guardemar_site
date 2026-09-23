import { createFileRoute } from '@tanstack/react-router'; import { StandardPageView } from '@/components/standard-page'
import { pageHead } from '@/lib/seo'
export const Route=createFileRoute('/how-it-works')({head:()=>pageHead({title:'How Second-Home Management Works | Guardemar',description:'From the first visit and key handover to scheduled inspections, reports and coordinated action. Not a rental service.',path:'/how-it-works/'}),component:()=> <StandardPageView pageKey="how-it-works" />})
