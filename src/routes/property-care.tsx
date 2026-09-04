import { createFileRoute } from '@tanstack/react-router'; import { StandardPageView } from '@/components/standard-page'
import { pageHead } from '@/lib/seo'
export const Route=createFileRoute('/property-care')({head:()=>pageHead({title:'Property Care Algarve | Guardemar',description:'The wider care framework supporting Guardemar home watch inspections, authorised access and local coordination in the Western Algarve.',path:'/property-care/'}),component:()=> <StandardPageView pageKey="property-care" />})
