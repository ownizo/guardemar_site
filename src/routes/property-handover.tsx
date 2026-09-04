import { createFileRoute } from '@tanstack/react-router'; import { StandardPageView } from '@/components/standard-page'
import { pageHead } from '@/lib/seo'
export const Route=createFileRoute('/property-handover')({head:()=>pageHead({title:'Property Handover Service Algarve | Guardemar',description:'A documented property baseline for overseas owners who have recently purchased a home in the Algarve.',path:'/property-handover-algarve/'}),component:()=> <StandardPageView pageKey="property-handover" />})
