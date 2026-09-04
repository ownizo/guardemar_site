import { createFileRoute } from '@tanstack/react-router'; import { StandardPageView } from '@/components/standard-page'
import { pageHead } from '@/lib/seo'
export const Route=createFileRoute('/arrival-preparation')({head:()=>pageHead({title:'Holiday Home Arrival Preparation Algarve | Guardemar',description:'Pre-arrival property checks and practical coordination so overseas owners arrive at their Algarve home informed.',path:'/arrival-preparation-algarve/'}),component:()=> <StandardPageView pageKey="arrival-preparation" />})
