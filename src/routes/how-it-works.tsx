import { createFileRoute } from '@tanstack/react-router'; import { StandardPageView } from '@/components/standard-page'
import { pageHead } from '@/lib/seo'
export const Route=createFileRoute('/how-it-works')({head:()=>pageHead({title:'How Guardemar Property Care Works',description:'From property assessment and secure key handover to scheduled inspections, reports and coordinated action.',path:'/how-it-works/'}),component:()=> <StandardPageView pageKey="how-it-works" />})
